;(function(){
	var http = require('http'),
			fs = require('fs'),
			io = require('socket.io'),
			url = require('url');
	
	var Player = require('./Players'),
			Ball = require('./Ball');
	
	var socket;

	var gamePage = fs.readFileSync(__dirname + '/index.html');
	var gameJs = fs.readFileSync(__dirname + '/game.js');

	var server = http.createServer(function(req, res){
		var pathname = url.parse(req.url).pathname;
		if(pathname == '/'){
			res.writeHead(200, {'Content-type': 'text/html'});
			res.end(gamePage);
		}else if(pathname == '/game.js'){
			res.writeHead(200, {'Content-type': 'text/javascript'});
			res.end(gameJs);
		}else{
			res.writeHead(400);
			res.end('404 Not Found');
		}
	});

	var app = server.listen(8000); 
	var players, canvasWidth, canvasHeight, ball, loop, time;
	/*
	players = [{id:client.id, x:.., y:..}, ...];
	*/
	
	function init(){
		players = [];
		socket = io.listen(app);
		socket.configure(function(){
			socket.set('transports', ['websocket']);
			socket.set('log level', 2);
		});

		setEventHandlers();
	}

	function setEventHandlers(){
		socket.sockets.on('connection', socketConnected);	
	}

	function socketConnected(client){
		client.on('disconnect', clientDisconnected);
		client.on('new player', newPlayer);
		client.on('player moved', playerMoved);
	}

	function clientDisconnected(){
		//remove from players array
		var playerId = this.id;
		players.splice(findIndexById(playerId), 1);
		//broadcast to other players that client disconnected
		if(players.length > 1)
			this.broadcast.emit('player disconnected', {id: playerId});	
	}

	function newPlayer(data){
		if(players.length <= 2){
			//only set the canvasWidth and canvasHeight with the first player
			if(!players.length){
				canvasHeight = data.canvasHeight;
				canvasWidth = data.canvasWidth;

				ball = new Ball(canvasWidth, canvasHeight);
			}
			
			var playerId = this.id;
			players.push({id: playerId});
	
			var playerIndex = findIndexById(playerId);
			players[playerIndex].x = data.x;
			players[playerIndex].y = (players.length === 1? canvasHeight - data.height - 5: 5);
			players[playerIndex].width = data.width;
			players[playerIndex].height = data.height;
			players[playerIndex].score = 0;

			var nth = (players.length > 1? 2: 1);
			players[playerIndex].nth = nth;
		
			//broadcast to other players about new player
			if(players.length > 1){
				this.broadcast.emit('new player', {id: playerIndex, id2: playerId, x: data.x});
			}

			//send new player data about existing players
			for(var i = 0, maxPlayers = players.length; i < maxPlayers; i++){
				if(players[i].id !== playerId)
					this.emit('new player', {id: i, id2: players[i].id, x: players[i].x, nth: 1});
			}
			
			this.emit('assign player', {nth: nth});
			this.emit('create ball', {x: ball.x, y: ball.y});
			
			if(players.length > 1){
				time = Date.now();
				loop = setInterval(gameLoop, 50);
			}
		}
	}

	function playerMoved(data){
		var playerId = this.id;
		var playerIndex = findIndexById(playerId);
		players[playerIndex].x = data.x;
		this.broadcast.emit('player moved', {x: data.x});
	}

	function findIndexById(playerId){
		for(var i = 0, maxPlayers = players.length; i < maxPlayers; i++){
			if(players[i].id === playerId)
				return i;	
		}
	}

	function gameLoop(){
		var gameOver = ball.update((Date.now() - time)/1000);
		
		for(var i = 0, maxPlayers = players.length; i < maxPlayers; i++){
			var nth = parseInt(players[i].nth);
			var playerYToCompare = (nth === 1? players[i].y: players[i].y + players[i].height);
			
			if(nth === 1){
				var yCompared = ball.y + ball.r >= playerYToCompare;
			}else{
				var yCompared = ball.y - ball.r <= playerYToCompare;
			}

			if(
					(ball.x + ball.r >= players[i].x &&
					ball.x - ball.r <= players[i].x + players[i].width) &&
					yCompared
			){
				players[i].score++;
				ball.directionY *= -1;
				socket.sockets.emit('update score', {nth: nth, score: players[i].score});
			}
		}

		socket.sockets.emit('move ball', {x: ball.x, y: ball.y});

		if(gameOver){
			console.log('Game Over');
			clearInterval(loop);
			socket.sockets.emit('game over', {msg: 'Game Over'});
		}

		time = Date.now();
	}

	init();
}());
