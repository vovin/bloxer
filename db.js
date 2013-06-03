var fs = require('fs');
var Db = exports.Db = function (path){
	if(!(this instanceof Db)) return new Db(path);
	this.path = path;
	this._blogs = [];
	this._entries = {};
	if(path){
		this.load(path);
	} else {console.log('not loading from file')}
}

Db.Db = Db;


Db.prototype.addNewBlog = function(id,url,name,next){
	this._blogs.push({id:id,url:url,name:name});
	return next && next(null,'sucess');
}

Db.prototype.getBlogs = function(callback){
	return callback(null,this._blogs);
}

Db.prototype.getBlogEntries = function(blogId, callback){
	var result = this._entries[blogId] || [];
	return callback(null,result);
}

Db.prototype.addBlogEntry = function(blogId, entry, callback){
	if(!(this._entries[blogId])){
		this._entries[blogId] = [];
	}
	this._entries[blogId].push(entry);
	return callback && callback(null);
}

Db.prototype.close = function(callback){
	this.path && this.save(this.path);
	callback && callback();
}

Db.prototype.save = function(path){
	console.log('saving db to file',path);
	var o = {blogs:this._blogs,entries:this._entries};
	var json = JSON.stringify(o);
	fs.writeFileSync(path,json);
}

Db.prototype.load = function(path){
	console.log('loading db fromfile',path);
	try{
		var json = fs.readFileSync(path);
		var o = JSON.parse(json);
		this._entries = o.entries;
		this._blogs = o.blogs;
	} catch(e){ console.log('unable to load db from file',path)}
}
