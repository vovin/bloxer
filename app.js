/**
 * Module dependencies.
 */
var express = require('express');
var app = module.exports = express.createServer();
var db = require('./db.js').Db('db/store.json');
var blogCount = -1;
var jsdom = require('jsdom');
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
    db.getBlogs(function(err,blogs){
        if (err) {
            throw err;
        }
        return res.render('index', {
            title: 'Express',
            blogs: blogs,
            count: blogs.length
        });
    })
});

app.get('/add/:address', function(req, res) {
    res.render('addBlogPage', {
        title: "Add new blog for scrapping",
        address: req.params.address
    });
});

app.post('/add/', function(req, res){
    addNewBlog(req.body.address, function(err, result) {
        if (err) {
            throw err;
        }
        res.render('addResult', {
            title: "adding new blog item",
            result: result,
            address: req.body.address
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
    jsdom.env({html:'http://'+req.params.adr, 
        src:[jquery],
        encoding:'binary',
        done: function (err, w){
            if(err){throw err;}

            res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
            var oHTML = w.document.getElementsByTagName('html')[0].outerHTML.replace('iso-8859-2','utf-8');
            console.log('type of outerHTML', typeof oHTML);
            var buf = new Buffer(oHTML, 'binary');
            
            var responseText = converter.decode(buf);
            
            res.write(responseText);
            res.end();
        }
    });

});

app.get('/blog/:id', function(req, res) {
    db.getBlogEntries(req.params.id,function(err,records){
        res.render('blogPage', {
            title: 'title',
            items: records
        });
    });
});

if(typeof process.env.C9_PORT ==='undefined'){
    process.env.C9_PORT=8888;
}


app.listen(process.env.C9_PORT);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);


db.getBlogs(function(err,blogs){
     if (!err) {
        blogCount = blogs.length-1;
}});


function addNewBlog(adr, next) {
    var blogId = ++blogCount;

    db.addNewBlog(blogId, adr, adr, function(err) {
        if (err) {
            next(null, "failed" + err);
        } else {
            getBlogDetails(adr, blogId, next);
        }
    });
}

function getBlogDetails(name, blogId, next) {
    console.log('getting details for ',name);
    jsdom.env({html:'http://' + name,
        src: [jquery],
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

function saveBlogItem(blogId,id,date,html) {
    db.addBlogEntry(blogId,{blogId: blogId, id: id, dateString: date, content: html}, function(e){if(e) throw err;});
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
            var date = item.prevAll('.BlogDataWpisu').first().text().trim();
            html = converter.decode(html);
            date = converter.decode(date);
            console.log('saving item',id);
            saveBlogItem(blogId,id,date,html);
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
