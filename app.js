/**
 * Module dependencies.
 */
var express = require('express');
var app = module.exports = express.createServer();
var alfred = require('alfred');
var db;
var blogCount = -1;
var scraper = require('scraper');
var request = require('request');
var jsdom = require('jsdom');
//var Iconv = require('iconv').Iconv;
var fs = require('fs');
var Encoder = require('./encoding.js'), converter = new Encoder('iso-8859-2');
var jquery = fs.readFileSync("./jquery-1.6.1.min.js").toString();
process.setMaxListeners(0);



// Configuration
app.configure(function() {
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.logger());
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.cookieParser());
    app.use(express.session({
        secret: 'secret357'
    }));
    app.use(app.router);
    app.use(express.static(__dirname + '/public'));
});
app.configure('development', function() {
    app.use(express.errorHandler({
        dumpExceptions: true,
        showStack: true
    }));
});
app.configure('production', function() {
    app.use(express.errorHandler());
});
// Routes
app.get('/', function(req, res) {
    var blogs = [];
    db.blogs.scan(function(err, key, value) {
        if (err) {
            throw err;
        }
        if (err === null && key === null) {
            return res.render('index', {
                title: 'Express',
                blogs: blogs,
                count: blogCount
            });
        }
        blogs.push(value);
    }, true);
});

app.get('/add/:address', function(req, res) {
    addNewBlog(req.params.address, function(err, result) {
        if (err) {
            throw err;
        }
        res.render('addResult', {
            title: "adding new blog item",
            result: result,
            address: req.params.address
        });
    });
});

app.get('/close', function(req, res) {
    function stopAll() {
        process.exit();
    }
    db.close(function() {
        setTimeout(stopAll, 100);
    }); // all keymaps are closed with DB
    res.send('ok closing');
});

app.get('/route/:adr', function(req, res) {
/*
// Accept-Charset: utf-8    ???
    request({uri: 'http://'+req.params.adr, encoding:'binary'},function (err, resp, body){
            if(err){throw err;}
//            res.setEncoding('binary');
            var buf = new Buffer(body,'binary');
            var responseText = converter.convert(buf);
            res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
            res.write(responseText.toString('utf8').replace('iso-8859-2','utf-8'));
            res.end();
        });
        */

    jsdom.env({html:'http://'+req.params.adr, 
        src:[jquery],
        encoding:'binary',
        done: function (err, w){
            if(err){throw err;}

            res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
            var oHTML = w.document.getElementsByTagName('html')[0].outerHTML.replace('iso-8859-2','utf-8');
            console.log('type of outerHTML', typeof oHTML);
//            fs.writeFileSync('html',oHTML);
            var buf = new Buffer(oHTML, 'binary');
//            console.log('buffer created');
            
            var responseText = converter.decode(buf);//converter.convert(buf).toString('utf-8');
            
            res.write(responseText);
            res.end();
        }
    });

});

app.get('/blog/:id', function(req, res) {
    db.ensure('blog_' + req.params.id, function(err, blog_items) {
      if (err) {
          throw err;
      }
      blog_items.ensureIndex('id',{},function(i){return i.id},function(err,idxName){
        if (err) {
            throw err;
        }
        console.log('ensured index');
        
        var off=0;
        var page=10;
        blog_items.find({id: {'$neq':'a'}})
          .order('id ASC')
//          .offset(off)
//          .limit(page)
          .all(function(err, records) {
            if (err) {
                throw err;
            }
            res.render('blogPage', {
                title: 'title',
                items: records
            });
          });
       });
    });
});

if(typeof process.env.C9_PORT ==='undefined'){
    process.env.C9_PORT=8888;
}


app.listen(process.env.C9_PORT);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);

alfred.open('db', function(err, database) {
    if (err) {
        throw err;
    }
    db = database;
    db.ensure('blogs', function(err, blogs_key_map) {
        console.log('blogs key map attached');
        blogs_key_map.count(function(err, count) {
            blogCount = count;
        });
    });
});

function addNewBlog(adr, next) {
    var blogId = ++blogCount;
    db.blogs.put(blogId, {
        url: adr,
        name: adr
    }, function(validationErrors) {
        if (validationErrors) {
            next(null, "failed" + validationErrors);
        }
        else {
            getBlogDetails(adr, blogId, next);
        }
    });
}

function getBlogDetails(name, blogId, next) {
    /*
    request({uri: 'http://'+name},function(err,response,body){
        if(err){return next(err, "fail: "+err);}
        return next(null, "Success " + body);
    });
    return;
    */
    console.log('getting details for ',name);
    jsdom.env({html:'http://' + name,
        src: [jquery],
        //scripts: ["http://code.jquery.com/jquery-1.6.1.min.js"],
        encoding: 'binary',
        done: function(err, w) {
        if (err) {
            console.log("error",err);
            return next(err,null);
        }
        var $ = w.$;
        console.log('$',$);
        var u = $('.BlogStronicowanieStrony div a:last').attr('href').split('?');
        var count = (+u[1]);
        var link = u[0];
        var title = $('title').text();
        console.log(count,link,title);        
        // ToDo: save additional details
        
        function processPageCallback(err, nextUri, blogId){
            if(err){
                return next(err);
            }
            if(nextUri===null){
                return next(null,'success');
            }
            setTimeout((function(uri,blogId,ppage,next){return function processPage(){return ppage(uri,blogId,next);}})(nextUri,blogId,processBlogPage,processPageCallback),2000)
        }
        return processPageCallback(null,'http://' + name, blogId, processPageCallback);

    }});
}

function saveBlogItem(blogId,id,html) {
    db.ensure('blog_' + blogId, function(err, blog_items) {
        if (err) {
            throw err;
        }
        blog_items.put(id, {blogId: blogId, id: id, content: html},function(e){if(e){throw e;}});
    });
  
} // end of saveBlogItem function

// next(err, nextUri, blogId) - ends null, null, null
function processBlogPage(uri, blogId, next){
   console.log('processing url: ',uri);

    return jsdom.env({html:uri, src:[jquery], encoding:'binary', done:parsePage});

    function parsePage(err, window) {
        if (err){
            return next(err);
        }
        var $ = window.$;
        $('.BlogWpisBox').each(function (){
            var item = $(this);
            var id = item.find('a:first').attr('name');
            var html = item.html();
            html = converter.decode(html);
            console.log('saving item',id);
            saveBlogItem(blogId,id,html);
        });
        var nast = $('.BlogStronicowanieNastepne a');
        if(nast.length == 0){
            return next(null,null,null);
        }
        
        var nextUrl = 'http://'+ window.location.host + nast.attr('href');
        console.log('next url is', nextUrl);
        
        return next(null, nextUrl, blogId);
    }
}

