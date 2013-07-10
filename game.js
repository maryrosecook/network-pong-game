;(function(){

	var canvas = document.getElementById('canvas');
	var ctx = canvas.getContext('2d');
	canvas.width = 330;
	canvas.height = 500;
	canvas.style.display = 'block';
	canvas.style.margin = 'auto';
	var player, otherPlayer, ball, game;
	var time, pressedKey = [];

	function Paddle(){
		this.w = 50;
		this.h = 5;
		this.x = 0;
		this.y;
		this.vx = 200;
		this.color = '#fff';
		this.score = 0;

		this.move = function(mod){
			if(pressedKey[37] && this.x > 0){
				this.x -= this.vx * mod;
			}else if(pressedKey[39] && this.x + this.w < canvas.width){
				this.x += this.vx * mod;
			}
		}

		this.draw = function(){
			ctx.fillStyle = this.color;
			ctx.beginPath();
			ctx.fillRect(this.x, this.y, this.w, this.h);
			ctx.closePath();
		}
	}

	function Ball(x, y){
		this.r = 7;
		this.x = x;
		this.y = y;

		this.update = function(newX, newY){
			this.x = newX;
			this.y = newY;
		}

		this.draw = function(){
			ctx.fillStyle = '#f99';
			ctx.beginPath();
			ctx.arc(this.x, this.y, this.r, 0, 2*Math.PI);
			ctx.fill();
			ctx.closePath();
		}
	}

	function init(){

		socket = io.connect("http://localhost", {port: 8000, transports: ["websocket"]});

		//instantiate player
		player = new Paddle();

		//emit player has joined
		socket.emit('new player', {x: player.x, canvasWidth: canvas.width, canvasHeight: canvas.height, width: player.w, height: player.h});

		setEventHandlers();

		time = Date.now();
	}

	function setEventHandlers(){
		socket.on('new player', onNewPlayer);
		socket.on('assign player', onPlayerAssign);
		socket.on('create ball', onCreateBall);
		socket.on('move ball', onMoveBall);
		socket.on('player disconnected', onDisconnected);
		socket.on('player moved', onPlayerMoved);
		socket.on('game over', onGameOver);
		socket.on('update score', onUpdateScore);
	}

	function onNewPlayer(data){
		otherPlayer = new Paddle();
		otherPlayer.id = data.id;
		otherPlayer.x = data.x;
		otherPlayer.y = data.nth === 1? canvas.height - otherPlayer.h - 5: 5;

		otherPlayer.nth = data.nth;
		otherPlayer.id2 = data.id2;
	}

	function onPlayerAssign(data){
		player.nth = data.nth;
		player.y = (data.nth === 1)? canvas.height - player.h - 5: 5;
	}

	function onCreateBall(data){
		//instantiate the ball
		ball = new Ball(data.x, data.y);
	}

	function onMoveBall(data){
		ball.update(data.x, data.y);
	}

	function onDisconnected(data){
		delete otherPlayer;
	}

	function onPlayerMoved(data){
		otherPlayer.x = data.x;
	}

	function onGameOver(data){
		console.log(data.msg);
		clearTimeout(game);
		drawGameOver();
	}

	function onUpdateScore(data){
		if((parseInt(data.nth) === 1 && player.nth === 1) || (parseInt(data.nth) === 2 && player.nth === 2)){
			player.score = data.score;
		}else{
			otherPlayer.score = data.score;
		}
		console.log(player.score, otherPlayer.score);
	}


	window.addEventListener('keydown', function(e){
		pressedKey[e.keyCode] = true;
		socket.emit('player moved', {x: player.x});
	});

	window.addEventListener('keyup', function(e){
		delete pressedKey[e.keyCode];
	});

	//Rendering functions
	function drawCanvas(){
		ctx.fillStyle = '#333';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}

	function drawGameOver(){
		var player1 = parseInt(player.nth) === 1? player: otherPlayer;
		var player2 = parseInt(player.nth) === 2? player: otherPlayer;
		var totalScore = player1.score + player2.score;
		var winner = ((totalScore % 2) === 0)?2:1;

		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = '#fff';
		ctx.font = '30px Verdana';
		ctx.fillText('Game Over', (canvas.width - 100)/2, canvas.height/2, 100);
		ctx.font = '20px Verdana';
		ctx.fillText('Player ' + winner + ' Won!', (canvas.width - 60)/2, (canvas.height + 50)/2, 60);
		/*ctx.fillText('Player 1: ' + player1.score + ' Pts.', (W - 60)/2, (H + 50)/2, 60);
		ctx.fillText('Player 2: ' + player2.score + ' Pts.', (W - 60)/2, (H + 100)/2, 60);*/
	}

	function drawAll(){
		drawCanvas();
		player.draw();
		if(otherPlayer)
			otherPlayer.draw();
		if(ball)
			ball.draw();
	}

	function updateAll(mod){
		player.move(mod);
	}

	function gameLoop(){
		updateAll((Date.now() - time)/1000);
		drawAll();

		time = Date.now();

		game = setTimeout(gameLoop, 50);
	}

	init();
	gameLoop();
}());
