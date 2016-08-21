var jsdom = require("jsdom");
var svgpath = require("svgpath");
var AABB = require("./aabb");

var LINEARIZATION_THRESHOLD = 3;

var trimRE = /^\s*(.*?)\s*$/g;
var symbolRE = /^symbol:(.*?)(:(.*))?$/;

var linearize = require("./linearize");

function extendBoundingBoxFromPath(aabb, elem, pathDesc, stopElem)
{
    var path = svgpath(pathDesc).unarc().unshort().abs();

    var e = elem;
    while (e && e !== stopElem)
    {
        var transform = e.getAttribute("transform");
        if (transform)
        {
            path = path.transform(transform);
        }

        e = e.parentNode;
    }

    path.iterate(function (segment, index, curX, curY)
    {
        var command = segment[0];

        var i, x, y, x2, y2, x3, y3, x4, y4, relative, short;

        //noinspection FallThroughInSwitchStatementJS
        switch (command)
        {
            case "M":
                //console.log("M segment", segment);
                for (i = 1; i < segment.length; i += 2)
                {
                    x = segment[i];
                    y = segment[i + 1];

                    aabb.extend(x,y);
                }
                break;
            case "L":
                for (i = 1; i < segment.length; i += 2)
                {
                    aabb.extend(segment[i], segment[i+1]);
                }
                break;
            case "Z":
                break;
            case "Q":
                short = true;
            // intentional fallthrough
            case "C":
                //console.log("C segment", segment);
                for (i = 1; i < segment.length; i += short ? 4 : 6)
                {
                    x = curX;
                    y = curY;
                    x2 = segment[i];
                    y2 = segment[i + 1];
                    x3 = short ? x2 : segment[i + 2];
                    y3 = short ? y2 : segment[i + 3];
                    x4 = short ? segment[i + 2] : segment[i + 4];
                    y4 = short ? segment[i + 3] : segment[i + 5];


                    aabb.extend(x,y);

                    linearize(x,y,x2,y2,x3,y3,x4,y4, LINEARIZATION_THRESHOLD, function (x1,y1,x2,y2)
                    {
                        console.log("CONSUME", x1, y1, x2, y2);
                        aabb.extend(x2,y2);
                    });

                    curX = x;
                    curY = y;
                }
                break;
            default:
                throw new Error("path command '" + command + "' not supported yet");

        }
    }, false)



}

function pathForRect(elem)
{
    var x = +elem.getAttribute("x");
    var y = +elem.getAttribute("y");
    var w = +elem.getAttribute("width");
    var h = +elem.getAttribute("height");

    return "M" +
            x + "," +     y + " L" +
        (x+w) + "," +     y + " " +
        (x+w) + "," + (y+h) + " " +
            x + "," + (y+h) + "Z";
}

function extendBoundingBox(aabb, elem, stopElem)
{
    var tagName = elem.tagName;

    if (tagName === "g")
    {
        var kid = elem.firstChild;
        while (kid)
        {
            extendBoundingBox(aabb, kid, stopElem);
            kid = kid.nextSibling;
        }
    }
    else if (tagName === "rect")
    {
        extendBoundingBoxFromPath(aabb, elem, pathForRect(elem), stopElem);
    }
    else if (tagName === "path")
    {
        extendBoundingBoxFromPath(aabb, elem, elem.getAttribute("d"), stopElem);
    }
}

function postProcess(symbol)
{
    var groups = symbol.groups;
    var aabb = new AABB();
    for (var i = 0; i < groups.length; i++)
    {
        var group = groups[i];
        extendBoundingBox(aabb, group, group);
        groups[i] = group.innerHTML;
    }

    symbol.center = {
        x: (aabb.maxX + aabb.minX) / 2,
        y: (aabb.maxY + aabb.minY) / 2
    };
}

module.exports = function (source)
{
    this.cacheable();
    var done = this.async();

    if (!done)
    {
        throw new Error("This plugin needs to work async.");
    }

    var resourcePath = this.resourcePath;

    jsdom.env({
        html: source,
        done: function (errors, window)
        {
            if (errors)
            {
                return done(errors);
            }

            var document = window.document;

            var groups = document.querySelectorAll("g");

            var symbols = {};

            for (var i = 0; i < groups.length; i++)
            {
                var group = groups[i];

                var m = symbolRE.exec(group.getAttribute("id"));
                if (m)
                {
                    var symbolName = m[1];
                    var layer = m[3] || "default";

                    var symbol = symbols[symbolName];
                    if (!symbol)
                    {
                        symbol = {
                            name: symbolName,
                            layers: [],
                            groups: [],
                            styles: [],
                        };
                        symbols[symbolName] = symbol;
                    }

                    symbol.layers.push(layer);
                    symbol.groups.push(group);
                    symbol.styles.push(group.getAttribute("style"));
                }
            }

            for (var name in symbols)
            {
                if (symbols.hasOwnProperty(name))
                {
                    postProcess(symbols[name]);
                }
            }

            done(null, "module.exports = " + JSON.stringify(symbols) + ";\n");
        }
    });
};



