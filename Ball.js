function Ball(w, h){
	var CANVAS_WIDTH = w;
	var CANVAS_HEIGHT = h;

	this.r = 7;
	this.x = CANVAS_WIDTH/2;
	this.y = CANVAS_HEIGHT/2;
	this.vx = 200;
	this.vy = 200;
	this.directionX = (Math.random() > 0.5? 1: -1);
	this.directionY = (Math.random() > 0.5? 1: -1);

	this.update = function(mod){
		if(this.x - this.r <= 0 || this.x + this.r >= CANVAS_WIDTH)
			this.directionX *= -1;

		this.x += (this.vx * this.directionX) * mod;
		this.y += (this.vy * this.directionY) * mod;

		//only return false when ball has passed the floor or ceiling of the game world
		if(this.y - this.r <= 0 || this.y + this.r >= CANVAS_HEIGHT)
			return true;

		return false;
	}

  // return true when ball has betmeen floor and ceiling of game world
  this.isInPlayArea = function() {
    return this.y - this.r > 0 && this.y + this.r < CANVAS_HEIGHT;
  };
}

module.exports = Ball;
