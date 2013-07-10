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
        this.ball = new Ball(this.height, this.height);
		  }

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
		  for(var i = 0, maxPlayers = this.players.length; i < maxPlayers; i++){
			  if(this.players[i].id !== playerId)
				  client.emit('new player', {id: i, id2: this.players[i].id, x: this.players[i].x, nth: 1});
		  }

		  client.emit('assign player', {nth: nth});
		  client.emit('create ball', {x: this.ball.x, y: this.ball.y});

		  if(this.players.length > 1){
        startGame();
		  }
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

var eventHandlers = {
  socketConnected: function(client){
	  client.on('disconnect', eventHandlers.clientDisconnected);
	  client.on('new player', function(data) {
      game.addPlayer(this, data);
    });
	  client.on('player moved', eventHandlers.playerMoved);
  },

  clientDisconnected: function(){
	  //remove from players array
	  var playerId = this.id;
	  game.players.splice(findIndexById(playerId), 1);
	  //broadcast to other players that client disconnected
	  if(game.players.length > 1)
		  this.broadcast.emit('player disconnected', {id: playerId});
  },

  playerMoved: function(data){
	  var playerId = this.id;
	  var playerIndex = findIndexById(playerId);
	  game.players[playerIndex].x = data.x;
	  this.broadcast.emit('player moved', {x: data.x});
  }
};

function setEventHandlers(socket){
	socket.sockets.on('connection', eventHandlers.socketConnected);
}

function findIndexById(playerId){
	for(var i = 0, maxPlayers = game.players.length; i < maxPlayers; i++){
		if(game.players[i].id === playerId)
			return i;
	}
}

function startGame() {
  var time = Date.now();
	var loop = setInterval(function() {
	  game.ball.update((Date.now() - time)/1000);

	  for(var i = 0, maxPlayers = game.players.length; i < maxPlayers; i++){
		  var nth = parseInt(game.players[i].nth);
		  var playerYToCompare = (nth === 1? game.players[i].y: game.players[i].y + game.players[i].height);

		  if(nth === 1){
			  var yCompared = game.ball.y + game.ball.r >= playerYToCompare;
		  }else{
			  var yCompared = game.ball.y - game.ball.r <= playerYToCompare;
		  }

		  if ((game.ball.x + game.ball.r >= game.players[i].x &&
			     game.ball.x - game.ball.r <= game.players[i].x + game.players[i].width) &&
				  yCompared) {
			  game.players[i].score++;
			  game.ball.directionY *= -1;
			  socket.sockets.emit('update score', {nth: nth, score: game.players[i].score});
		  }
	  }

	  socket.sockets.emit('move ball', {x: game.ball.x, y: game.ball.y});

	  if(!game.ball.isInPlayArea()){
		  console.log('Game Over');
		  clearInterval(loop);
		  socket.sockets.emit('game over', {msg: 'Game Over'});
	  }

	  time = Date.now();
  }, 50);
};

var socket = initSocketIO(startServer());
setEventHandlers(socket);
