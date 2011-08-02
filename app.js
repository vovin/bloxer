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
var Iconv = require('iconv').Iconv;
var converter = new Iconv('ISO-8859-2','UTF-8');
//var converter = new Iconv('ISO-8859-2','UTF-8');
var fs = require('fs');






var xmlunicodetable_ISO8859_2 = [
    0x0080, 0x0081, 0x0082, 0x0083, 0x0084, 0x0085, 0x0086, 0x0087,
    0x0088, 0x0089, 0x008a, 0x008b, 0x008c, 0x008d, 0x008e, 0x008f,
    0x0090, 0x0091, 0x0092, 0x0093, 0x0094, 0x0095, 0x0096, 0x0097,
    0x0098, 0x0099, 0x009a, 0x009b, 0x009c, 0x009d, 0x009e, 0x009f,
    0x00a0, 0x0104, 0x02d8, 0x0141, 0x00a4, 0x013d, 0x015a, 0x00a7,
    0x00a8, 0x0160, 0x015e, 0x0164, 0x0179, 0x00ad, 0x017d, 0x017b,
    0x00b0, 0x0105, 0x02db, 0x0142, 0x00b4, 0x013e, 0x015b, 0x02c7,
    0x00b8, 0x0161, 0x015f, 0x0165, 0x017a, 0x02dd, 0x017e, 0x017c,
    0x0154, 0x00c1, 0x00c2, 0x0102, 0x00c4, 0x0139, 0x0106, 0x00c7,
    0x010c, 0x00c9, 0x0118, 0x00cb, 0x011a, 0x00cd, 0x00ce, 0x010e,
    0x0110, 0x0143, 0x0147, 0x00d3, 0x00d4, 0x0150, 0x00d6, 0x00d7,
    0x0158, 0x016e, 0x00da, 0x0170, 0x00dc, 0x00dd, 0x0162, 0x00df,
    0x0155, 0x00e1, 0x00e2, 0x0103, 0x00e4, 0x013a, 0x0107, 0x00e7,
    0x010d, 0x00e9, 0x0119, 0x00eb, 0x011b, 0x00ed, 0x00ee, 0x010f,
    0x0111, 0x0144, 0x0148, 0x00f3, 0x00f4, 0x0151, 0x00f6, 0x00f7,
    0x0159, 0x016f, 0x00fa, 0x0171, 0x00fc, 0x00fd, 0x0163, 0x02d9
];
function iso2utf8(input, len, unicodetable) {
    // input = Buffer.
    if (!Buffer.isBuffer(input)) {
        input = new Buffer(input, 'binary');
    }
    // len = lenght of Buffer to translate
    // calculate new buffer length
    var i, opos, ac = 0;
    var output;
    var c;

    for (i = 0; i < len; ++i) {
        if (input[i] >= 0x80) {
            ++ac;
        }
    }

    output = new Buffer(len + ac * 2); // three bytes for each high charactrer, just in case if we need them
    for (i = 0, opos = 0; i < len; ++i) {
        c = input[i];
        if (c >= 0x80) {
            c = unicaodetable[c - 0x80];
            if (!c) {
                // undefined character change to '?'
                c = '?'.charAtCode(0);
            } else {
                if (c < 0x800) {
                    // two bytes char
                    output[opos++] = ((c >> 6) & 0x1F) | 0xC0;
                    c = (c & 0x3F) | 0x80;
                } else {
                    // three bytes character
                    output[opos++] = ((c >> 12) & 0x0F) | 0xE0;
                    output[opos++] = ((c >> 6) & 0x3F) | 0x80;
                    c = (c & 0x3F) | 0x80;
                }
            }
        }
        output[opos++] = c;

    }
    return output.slice(0, opos);
}

function fromLatin2(buf, len) {
    len = len || buf.length;
    return iso2utf8(buf, len, xmlunicodetable_ISO8859_2).toString('utf8');
}





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
    jsdom.env('http://'+req.params.adr, 
        ['file:///'+__dirname+'/jquery-1.6.1.min.js'],{encoding:'binary'},
        function (err, w){
            if(err){throw err;}

            res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
            var oHTML = w.document.getElementsByTagName('html')[0].outerHTML.replace('iso-8859-2','utf-8');
            console.log('type of outerHTML', typeof oHTML);
//            fs.writeFileSync('html',oHTML);
            var buf = new Buffer(oHTML, 'binary');
//            console.log('buffer created');
            
            var responseText = fromLatin2(buf);//converter.convert(buf).toString('utf-8');
            
            res.write(responseText);
            res.end();
        }
    );

});

app.get('/blog/:id', function(req, res) {
    db.ensure('blog_' + req.params.id, function(err, blog_items) {
        if (err) {
            throw err;
        }
        var items = [];
        blog_items.scan(function(err, key, value) {
            if (err) {
                throw err;
            }
            if (err === null && key === null) {
                res.render('blogPage', {
                    title: 'title',
                    items: items
                });
            }
            items.push(value);
        }, true);
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
    jsdom.env('http://' + name, ['file:///'+__dirname+'/jquery-1.6.1.min.js'], function(err, w) {
        if (err) {
            return next(err,null);
        }
        var $ = w.$;
        var u = $('.BlogStronicowanieStrony div a:last').attr('href').split('?');
        var count = (+u[1]);
        var link = u[0];
        var title = $('title').text();
        console.log(count,link,title);
        var l = 'http://' + name + link + '?' + count;
        console.log('visiting link:',l);
        jsdom.env(l, ['file:///'+__dirname+'/jquery-1.6.1.min.js'], function (err, w) {
          if(err){ return next(err,null);}
          console.log('no error on ',l);
          
          var $ = w.$;
          $('.BlogWpisBox').each(function (){
            var item = $(this);
            var id = item.find('a:first').attr('name');
            var html = item.html();
            console.log('saving item',id);
            saveBlogItem(blogId,id,html);
          });
        });
        return next(null,"success");
    });
}

function saveBlogItem(blogId,id,html) {
    db.ensure('blog_' + blogId, function(err, blog_items) {
        if (err) {
            throw err;
        }
        blog_items.put(id, {blogId: blogId, id: id, content: html},function(e){if(e){throw e;}});
    });
  
} // end of saveBlogItem function



