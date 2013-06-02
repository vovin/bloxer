var Db = exports.Db = function (path){
	if(!(this instanceof Db)) return new Db(path);
	this.path = path;
	this._blogs = [];
	this._entries = {};
}

Db.Db = Db;
//modules.exports = Db;

Db.prototype.addNewBlog = function(id,url,name,next){
	this._blogs.push({id:id,url:url,name:name});
	return next && next(null,'sucess');
}

Db.prototype.getBlogs = function(callback){
	return callback(null,this._blogs);
}

Db.prototype.getBlogEntries = function(blogId, callback){
	return callback(null,this._entries[blogId]);
}

Db.prototype.addBlogEntry = function(blogId, entry, callback){
	if(!(this._entries[blogId])){
		this._entries[blogId] = [];
	}
	this._entries[blogId].push(entry);
	return callback && callback(null);
}

Db.prototype.close = function(callback){
	console.log('saving not yet implemented');
	callback && callback();
}
