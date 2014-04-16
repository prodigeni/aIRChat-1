var socket = io.connect(hostname);

// Storage for the ID of the interval used to blink the title
// when there is a message waiting for the user.
var intervalID = undefined;
var windowFocused = true;
 
// Array of chat objects
var chats = new Array();
 
// Maps the name of a given server to the user's nick on that server.
var usernicks = {};

socket.emit('serverJoin', {
  server: 'irc.freenode.net', 
  nick: username,
  firstchannel: '#ctf-portside',
  sid: sid
});

var chatTab = function (server, channel, active) {
  if (active === undefined || active === false) {
    var mod = '';
  } else {
    var mod = '.active';
  }
  return $('dd' + mod).filter(function () {
    return $(this).data('server') === server && $(this).data('channel') === channel;
  }).first();
};

var messageBox = function (server, channel, active) {
  if (active === undefined || active === false) {
    var mod = '';
  } else {
    var mod = '.active';
  }
  return $('div' + mod).filter(function () {
    return $(this).data('server') === server && $(this).data('channel') === channel;
  }).first();
};

// Array remove - By John Resig
Array.prototype.remove = function (start, end) {
  var tail = this.slice((end || start) + 1 || this.length);
  this.length = start < 0 ? this.length + start : start;
  return this.push.apply(this, tail);
};

var addMessage = function (data) {
  var $msgDiv = messageBox(data.server, data.channel);
  var $tab = chatTab(data.server, data.channel).children('a').first();
  var chat = chats[chatIndex(chats, data.server, data.channel)];
  var user = chat.users[userIndex(chat.users, data.from)];
  console.log('Got user');
  console.log(user);
  if (user === undefined) {
    var picture = '/images/defaultusericon.jpg';
  } else {
    var picture = user.picture;
  }
  var time = ' at ' + formattedMessageTime(); // From users.js

  var highlight = '';
  if (data.from === usernicks[data.server]) {
    highlight = ' self'; // Space needed to separate class names
  } else if (data.message.indexOf(usernicks[data.server]) != -1) {
    highlight = ' mention';
  }

  var $newMsg = $(
    '<div class="message">' +
    '  <div class="left">' +
    '    <img src="' + picture + '" />' +
    '  </div>' +
    '  <div>' +
    '    <div class="titlebar' + highlight + '">' +
    '      <span>' + data.from + ' in ' + data.channel + time + '</span>' +
    '    </div>' +
    '    <div class="messageContent' + highlight + '">' +
    '      <span>' + data.message + '</span>' +
    '    </div>' +
    '  </div>' +
    '</div>'
  );
  $msgDiv.append($newMsg);
  $tab.children('span.notifyLow').text(chat.lowPriorityNotifications());
  $tab.children('span.notifyHigh').text(chat.highPriorityNotifications());
  var scrollDist = $msgDiv[0].scrollHeight - $msgDiv[0].offsetHeight - $msgDiv[0].scrollTop;
  if (scrollDist >= 40) {
    $msgDiv.scrollTop($msgDiv[0].scrollHeight);
  }
};

var clearNotifications = function (evt) {
  var server = $(evt.currentTarget).data('server');
  var channel = $(evt.currentTarget).data('channel');
  var $anchor = $(evt.currentTarget).children('a');
  chats[chatIndex(chats, server, channel)].clearNotifications();
  $anchor.children('span.notifyLow').text('0');
  $anchor.children('span.notifyHigh').text('0');
};

// Add a new tab to the list of chat tabs and a content div to contain
// the nick list and messages.
var addChatSection = function (server, chanOrNick) {
  var $newTab = $(
    '<dd data-server="' + server + '" data-channel="' + chanOrNick + '">' +
    '  <a href="#panel_' + label(server, chanOrNick) + '">' +
    '    <span class="notifyLow">0</span>' +
    '    <span class="notifyHigh">0</span>' +
    '    ' + chanOrNick +
    '  </a>' +
    '</dd>'
  );
  $('dl#chatList').append($newTab);
  $newTab.click(clearNotifications);
  $('div#chatContent').append($(
    '<div class="content" id="panel_' + label(server, chanOrNick) + '" ' +
         'data-server="' + server + '" data-channel="' + chanOrNick + '">' +
    '</div>'
  ));
  // Set the height for this and any other chat content areas to fit nicely.
  $('div.content').height(($(window).height() - 130) + 'px');
};

var joinChat = function (server, channel) {
  chats.push(new Chat(server, channel));
  addChatSection(server, channel);
};

var titleBlinker = function (origTitle, altTitle) {
  return (function () {
    document.title = altTitle;
    setTimeout(function () {
      document.title = origTitle;
    }, 500);
    });
};

// Display a message about some occurrence in the channel.
// the newdata field is only required for events involving some data changing.
// This could be a user's nick being changed, or something else.
var channelNotification = function (type, server, channel, data, newdata) {
  var message;
  if (type === 'joined') {
    message = data + ' has joined this channel.';
  } else if (type === 'departed') {
    message = data + ' has parted from this channel.';
  } else if (type === 'changedNick') {
    message = data + ' has changed their nick to ' + newdata + '.';
  } else {
    message = 'Received unknown notification event of type ' + type + ' on ' + 
              server + '/' + channel + ' from ' + data;
  }
  addMessage({
    from: 'System',
    server: server,
    channel: channel,
    message: message
  });
};

socket.on('notifyLow', function (data) {
  var $ad = $('div.active');
  var chat = chats[chatIndex(chats, data.server, data.channel)];
  if ($ad.data('server') != data.server || $ad.data('channel') != data.channel) {
    if (data.message.indexOf(usernicks[data.server]) != -1) {
      chat.gotHighPriorityMessage();
    } else {
      chat.gotLowPriorityMessage(); 
    }
  }
  if (windowFocused === false && intervalID === undefined) {
    intervalID = setInterval(titleBlinker('aIRChat', '[!!] aIRChat [!!]'), 1000);
  }
  chat.users[userIndex(chat.users, data.from)].gotNewMessage();
  addMessage(data);
});

socket.on('notifyHigh', function (data) {
  var $activeDiv = $('div.active');
  var chat = chats[chatIndex(chats, data.server, data.channel)];
  if (chat === undefined) {
    joinChat(data.server, data.from);
  }
  if ($activeDiv.data('server') != data.server || $activeDiv.data('channel') != data.channel) {
    chat.gotHighPriorityNotification();
  }
  chat.users[userIndex(chat.users, data.from)].gotNewMessage();
  addMessage({
    from: data.from,
    server: data.server,
    channel: data.from,
    message: data.message
  });
  if (windowFocused === false && intervalID === undefined) {
    intervalID = setInterval(titleBlinker('aIRChat', '[!!] aIRChat [!!]'), 1000);
  }
});

socket.on('connected', function (server, channel) {
  usernicks[server] = username;
});

// Create a listing of nicks for the appropriate channel.
// The list will not be rendered until the channel is the active one.
socket.on('nickList', function (data) {
  var chat = chats[chatIndex(chats, data.server, data.channel)];
  console.log('Got nicklist for ' + data.channel);
  for (var i = data.users.length - 1; i >= 0; i--) {
    chat.users.push(new User(
      data.users[i].nick, 
      data.users[i].bio, 
      data.users[i].contact, 
      data.users[i].picture, 
      data.users[i].server
    ));
  }
  chat.users.push(new User(
    'System', '', '', '/images/defaultusericon.jpg', data.server
  ));
});

// Add a new nick to the list of nicks for the provided channel. 
// Create a new chat tab if the aIRChat user is the one joining.
socket.on('joined', function (data) {
  if (chatIndex(chats, data.server, data.channel) === -1) { 
    usernicks[data.server] = data.nick;
  }
  if (data.nick === usernicks[data.server] ) {
    joinChat(data.server, data.channel);
  } else {
    var index = chatIndex(chats, data.server, data.channel);
    chats[index].users.push(new User(
      data.nick, data.bio, data.contact, data.picture, data.server
    ));
    channelNotification('joined', data.server, data.channel, data.nick);
  }
});

// Display a message telling the user they were kicked from the channel.
// Also deactivate the send mechanism for this channel.
socket.on('kicked', function (data) {
  addMessage({
    from: 'System',
    server: data.server,
    channel: data.channel,
    message: 'You were kicked by ' + data.by + '. Reason provided: ' + data.reason
  });
  // TODO
  // Block the user from trying to send messages to the channel
  // that they were kicked from.
  // Might want to use an alert or something and close the tab automatically.
});

socket.on('newNick', function (data) {
  var chat = chats[chatIndex(chats, data.server, data.channel)];
  chat.getUser(data.old).changeNick(data.new);
  channelNotification('changedNick', data.server, data.channel, data.old, data.new);
});

socket.on('invited', function (data) {
  var msg = 'You have been invited to the channel ' + data.to;
  msg += ' on ' + data.server + ' by ' + data.by + '\n';
  msg += 'Would you like to join this channel now?';
  if (confirm(msg)) {
    socket.emit('joinChannel', {server: data.server, channel: data.to, sid: sid});
  }
});

socket.on('userLeft', function (data) {
  var cindex = chatIndex(chats, data.server, data.from);
  if (cindex === -1) { // The user is the one who left, and the chat has been deleted
    return;
  }
  var users = chats[cindex].users;
  userList.remove(userIndex(users, data.nick));
  channelNotification('departed', data.server, data.from, data.nick);
});

$('#messageInput').keypress(function (evt) {
  var server = $('div.active').first().data('server');
  var dest = $('div.active').first().data('channel');
  if (evt.which === 13) { // On [Enter]
    if ($('div.tabs-content').length === 0 || !server) {
      alert('You cannot send a message until you have joined and selected chat.');
      return;
    }
    var $ta = $('#messageInput');
    addMessage({
      server: server,
      channel: dest, 
      from: usernicks[server], 
      message: $ta.val()
    });
    socket.emit('writeChat', {
      server: server, 
      destination: dest, 
      message: $ta.val(),
      sid: sid
    });
    $ta.val('');
  }
});

// TODO
// Make sure the channel name is valid
$('a#joinNewChannel').click(function (evt) {
  var server = $('div.active').data('server');
  var chanName = $('#newChannelName').val();
  if (server === undefined) {
    alert('You must select a chat tab for a channel belonging to the ' +
          'same server the channel you wish to join is in.'
    );
  }
  socket.emit('joinChannel', {server: server, channel: chanName, sid: sid});
});

$('a#connectToNewServer').click(function (evt) {
  var serverName = $('#newServerAddr').val();
  var firstChannel = $('#newServerChannel').val();
  socket.emit('serverJoin', {
    server: serverName,
    nick: username,
    firstchannel: firstChannel,
    sid: sid
  });
});

$('a[data-reveal-id=getNickList]').click(function (evt) {
  var channel = $('div.active').first().data('channel');
  var server = $('div.active').first().data('server');
  if (channel === undefined || server === undefined) {
    $('div#getNickList > h1').text(
      'You must select a channel to retrieve a list of users from.'
    );
    return;
  }
  var users = chats[chatIndex(chats, server, channel)].users;
  $('div#getNickList > h1').text('Users in ' + channel);
  var $list = $('table#listOfNicks tbody');
  $list.html(''); // Clear out the table before filling it
  for (var i = users.length - 1; i >= 0; i--) {
    if (users[i].nick === usernicks[server]) {
      continue;
    }
    $list.prepend($(
      '<tr>' +
      '  <td>' + users[i].nick + '</td>' +
      '  <td>' + users[i].lastMessage + '</td>' +
      '  <td><a href="#" class="sendPMButton small button" data-nick="' + users[i].nick + '">Message</a></td>' +
      '  <td><a href="#" class="viewProfButton small button" data-nick="' + users[i].nick + '">Profile</a></td>' +
      '</tr>'
    ));
  }
});

$('a#sendPrivMsg').click(function (evt) {
  var msg = $('#privMsgContents').val();
  var nick = $('#privMsgNick').val();
  var server = $('div.active').first().data('server');
  joinChat(server, nick);
  addMessage({server: server, channel: nick, from: usernicks[server], message: msg});
  socket.emit('writeChat', {server: server, destination: nick, message: msg, sid: sid});
});

$('a[data-reveal-id=partChannel]').click(function (evt) {
  var channel = $('div.active').first().data('channel');
  $('div#partChannel div.row div.columns p').text(
    'Are you sure you want to leave ' + channel + '?'
  );
});

$('a#confirmPartChannel').click(function (evt) {
  var channel = $('div.active').first().data('channel');
  var server = $('div.active').first().data('server');
  var index = chatIndex(chats, server, channel);
  chats.remove(index);
  $('dd.active').first().remove();
  $('div.active').first().remove();
  if (channel[0] === '#') { // Channel, not a private chat
    console.log('Parting from ' + channel);
    socket.emit('part', {
      server: server, 
      channel: channel, 
      message: 'aIRChat client parted.',
      sid: sid
    });
  }
});

$('a#changeNickConfirm').click(function (evt) {
  var newNick = $('input#newNickInput').val();
  if (newNick.length === 0) {
    alert('You need to provide a new nickname to switch to!');
    return;
  }
  var server = $('dd.active').first().data('server');
  if (!server) {
    alert('You have not yet selected a chat tab to base changes on!');
    return;
  }
  socket.emit('changeNick', {server: server, sid: sid, nick: newNick});
  usernicks[server] = newNick;
});

$('#submitProfile').click(function (evt) {
  var ci = $('#contact').val();
  var bi = $('#bio').val();
  var pp = $('#profilePicLocation').val();
  $.ajax('/profileupdate', {
    type    : 'POST',
    data    : {
      username : username,
      password : $('#passwordConfirm').val(),
      contact  : ci,
      bio      : bi,
      picture  : pp
    },
    error   : function (obj, status, errorThrown) {
      alert('Your profile information could not be updated. Reason: ' + status);
    },
    success : function (data, status, obj) {
      if (data.success) {
        alert('Your profile information was updated successfully.');
        $('#ownProfilePic').attr('src', pp);
        profilepic = pp;
        contact = ci;
        userbio = bi;
      } else {
        alert('Your profile information could not be updated.\n' +
              'Please ensure that you have entered the correct password and try again.');
      }
    }
  });
});

$(window).on('resize', function (evt) {
  $('div.content').height(($(window).height() - 130) + 'px');
  $('div#nickListPane').height(($(window).height() - 250) + 'px');
});

$(document).ready(function () {
  // It doesn't make sense to set any chat content areas' height here
  // because none exist yet!
  $('div#nickListPane').height(($(window).height() - 250) + 'px');
});

$(window).focus(function (evt) {
  windowFocused = true;
  if (intervalID != undefined) {
    clearInterval(intervalID);
    intervalID = undefined;
  }
});

$(window).blur(function (evt) {
  windowFocused = false;
});
