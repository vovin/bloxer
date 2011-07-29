/**
 * Module dependencies.
 */

var express = require('express');

var app = module.exports = express.createServer();

var alfred = require('alfred');
var db;
var blogCount = -1;

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
    function stopAll(){
        process.exit();
    }
    db.close(function(){
        setTimeout(stopAll,100);
    }); // all keymaps are closed with DB
    res.send('ok closing');
});

app.listen(process.env.C9_PORT);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);



alfred.open('db', function(err, database) {
    if (err) {
        throw err;
    }
    db = database;
    db.ensure('blogs', function(err, users_key_map) {
        console.log('blogs key map attached');
        users_key_map.count(function(err, count) {
            blogCount = count
        });
    });
});


function addNewBlog(adr, next) {
    db.blogs.put(++blogCount, {
        url: adr,
        name: adr
    }, function(validationErrors) {
        if (validationErrors) {
            next(null, "failed" + validationErrors);
        }
        else {
            next(null, "success");
        }
    });
}