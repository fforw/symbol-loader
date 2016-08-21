var assert = require("power-assert");
var path = require("path");
var sinon = require("sinon");
var fs = require("fs");

var Loader = require("../lib/loader");

var moduleExportsRE = /module.exports = (.*);/;

function extractJSONExport(doc)
{
    var m = moduleExportsRE.exec(doc);
    if (!m)
    {
        throw new Error("Could not extract JSON export");
    }

    return JSON.parse(m[1]);
}


function load(relPath, cb, query)
{

    var cacheableSpy = sinon.spy();

    fs.readFile(path.join(__dirname, relPath), "UTF8", function (err, data)
    {
        if (err)
        {
            throw err;
        }

        Loader.call({
            cacheable: cacheableSpy,
            query: query,
            async: function ()
            {
                return (err, doc) => {
                    if (err)
                    {
                        cb(err);
                    }

                    // should be cacheable
                    assert(cacheableSpy.called);

                    cb(null, extractJSONExport(doc));
                };
            }
        }, data)
    })
}

describe("Symbol loader", function(){



    it("loads symbols", function(done)
    {
        load("test-documents/test.svg", (err, data) => {

            if (err)
            {
                done(err);
                return;
            }
            //console.log(JSON.stringify(data, null, 4));

            assert(data.foo.name === "foo");
            assert(data.foo.layers.length === 1);
            assert(data.foo.layers[0] === "default");

            assert(data.foo.groups.length === 1);
            assert(data.foo.groups[0].indexOf('rect') >= 0);
            assert(data.foo.styles[0] === "fill: #00f; fill-opacity: 0.5;");

            assert.deepEqual(data.foo.center, { x: 50, y: 50});

            done();
        });
    });


    it("parses styles", function(done)
    {
        load("test-documents/test.svg", (err, data) => {

            if (err)
            {
                done(err);
                return;
            }
            //console.log(JSON.stringify(data, null, 4));

            assert.deepEqual(
                data.foo.styles[0],
                {
                    fill: "#00f",
                    fillOpacity: 0.5
                } );

            done();
        }, { parseStyle : true});
    });

    it("supports multiple layers", function(done)
    {
        load("test-documents/test2.svg", (err, data) => {

            if (err)
            {
                done(err);
                return;
            }
            //console.log(JSON.stringify(data, null, 4));

            assert(data.bar.layers.length === 2);
            assert(data.bar.layers[0] === "bg");
            assert(data.bar.layers[1] === "fg");

            assert(data.bar.groups.length === 2);
            assert(data.bar.groups[0].indexOf('rect') >= 0);
            assert(data.bar.groups[1].indexOf('circle') >= 0);

            assert(data.bar.center.x|0 === 0);
            assert(data.bar.center.y|0 === 70);

            done();
        });
    });

    it("linearizes paths", function(done)
    {
        load("test-documents/test3.svg", (err, data) => {

            if (err)
            {
                done(err);
                return;
            }
            //console.log(JSON.stringify(data, null, 4));

            assert(data.qux.layers.length === 1);
            assert(data.qux.layers[0] === "default");

            assert(data.qux.center.y > 450);

            done();
        });
    });
});
