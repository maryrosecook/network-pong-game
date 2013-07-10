var http = require('http'),
    fs = require('fs'),
    io = require('socket.io'),
    url = require('url');

var Player = require('./Players'),
    Ball = require('./Ball');

var socket;

var Game = function() {
  this.players = [];
};

Game.prototype = {
  setPlayAreaDimensions: function(width, height) {
    this.width = width;
    this.height = height;
  },

  addPlayer: function(client, data) {
	  if(this.players.length <= 2) {
		  //only set the canvasWidth and canvasHeight with the first player
		  if(!this.players.length){
        this.setPlayAreaDimensions(data.canvasWidth, data.canvasHeight);
        this.ball = new Ball(this.width, this.height);
		  }

      // this could be cleaned up
      // just make a player obj, assign to player, push onto this.players,
      // then setting x, y, width etc can be done on player

      // id2 seems redundant.  I think it can be deleted.

      // why do you broadcast/emit player ids that are their array indices,
      // rather than just using their client.id?

		  var playerId = client.id;
		  this.players.push({id: playerId});

		  var playerIndex = findIndexById(playerId);
		  this.players[playerIndex].x = data.x;
		  this.players[playerIndex].y = (this.players.length === 1? data.canvasHeight - data.height - 5: 5);
		  this.players[playerIndex].width = data.width;
		  this.players[playerIndex].height = data.height;
		  this.players[playerIndex].score = 0;

		  var nth = (this.players.length > 1? 2: 1);
		  this.players[playerIndex].nth = nth;

		  //broadcast to other players about new player
		  if(this.players.length > 1){
			  client.broadcast.emit('new player', {id: playerIndex, id2: playerId, x: data.x});
		  }

		  //send new player data about existing players
		  for(var i = 0; i < this.players.length; i++){
			  if(this.players[i].id !== playerId)
				  client.emit('new player', {id: i, id2: this.players[i].id, x: this.players[i].x, nth: 1});
		  }

		  client.emit('assign player', {nth: nth});
		  client.emit('create ball', {x: this.ball.x, y: this.ball.y});

		  if(this.players.length > 1){
        this.start();
		  }
	  }
  },

  start: function() {
    var time = Date.now();
    var self = this;
	  var loop = setInterval(function() {
	    self.ball.update((Date.now() - time)/1000);

	    for(var i = 0, maxPlayers = self.players.length; i < maxPlayers; i++){
		    var nth = parseInt(self.players[i].nth);
		    var playerYToCompare = nth === 1 ?
          self.players[i].y :
          self.players[i].y + self.players[i].height;

		    if(nth === 1){
			    var yCompared = self.ball.y + self.ball.r >= playerYToCompare;
		    }else{
			    var yCompared = self.ball.y - self.ball.r <= playerYToCompare;
		    }

		    if ((self.ball.x + self.ball.r >= self.players[i].x &&
			       self.ball.x - self.ball.r <= self.players[i].x + self.players[i].width) &&
				    yCompared) {
			    self.players[i].score++;
			    self.ball.directionY *= -1;
			    socket.sockets.emit('update score', {nth: nth, score: self.players[i].score});
		    }
	    }

	    socket.sockets.emit('move ball', {x: self.ball.x, y: self.ball.y});

	    if(!self.ball.isInPlayArea()){
		    console.log('Game Over');
		    clearInterval(loop);
		    socket.sockets.emit('game over', {msg: 'Game Over'});
	    }

	    time = Date.now();
    }, 50);
  },

  movePlayer: function(client, data) {
	  var playerId = client.id;
	  var playerIndex = findIndexById(playerId);
	  this.players[playerIndex].x = data.x;
	  client.broadcast.emit('player moved', {x: data.x});
  },

  removePlayer: function(client) {
	  //remove from players array
	  var playerId = client.id;
	  this.players.splice(findIndexById(playerId), 1);
	  //broadcast to other players that client disconnected
	  if(this.players.length > 1) {
		  client.broadcast.emit('player disconnected', {id: playerId});
    }
  }
};

var serveStaticFile = function(filename, type, res) {
  fs.readFile(filename, 'utf8', function (err, data) {
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
};

var startServer = function() {
  var PORT = 8000;
  var app = http.createServer(function(req, res){
	  var pathname = url.parse(req.url).pathname;
	  if (pathname == '/') {
      serveStaticFile(__dirname + '/index.html', 'text/html', res);
	  } else if (pathname == '/game.js') {
      serveStaticFile(__dirname + '/game.js', 'text/javascript', res);
	  } else {
		  res.writeHead(400);
		  res.end('404 Not Found');
	  }
  }).listen(PORT);

  console.log("Server started on port", PORT);
  return app;
};

var game = new Game();
/*
	players = [{id:client.id, x:.., y:..}, ...];
*/

function initSocketIO(app){
	var socket = io.listen(app);
	socket.configure(function(){
		socket.set('transports', ['websocket']);
		socket.set('log level', 2);
	});

  return socket;
}

function setEventHandlers(socket){
	socket.sockets.on('connection', function(client) {
	  client.on('disconnect', function() {
      game.removePlayer(this);
    });

	  client.on('new player', function(data) {
      game.addPlayer(this, data);
    });

	  client.on('player moved', function(data) {
      game.movePlayer(this, data);
    });
  });
}

function findIndexById(playerId){
	for(var i = 0, maxPlayers = game.players.length; i < maxPlayers; i++){
		if(game.players[i].id === playerId)
			return i;
	}
}

var socket = initSocketIO(startServer());
setEventHandlers(socket);
