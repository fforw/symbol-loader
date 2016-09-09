var jsdom = require("jsdom");
var svgpath = require("svgpath");
var AABB = require("./aabb");

// Value representing the maximal error we are accepting when linearizing paths. The lower it is, the more line
// we will produce while linearizing
var LINEARIZATION_THRESHOLD = 5;

var symbolRE = /^symbol:(.*?)(:(.*))?$/;

var linearize = require("./linearize");

function trim(s)
{
    return s.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
}

var dehyphenateRE = /-(\w)/g;
function dehyphenate(s)
{
    return s.replace(dehyphenateRE, function (match, letter)
    {
        return letter.toLocaleUpperCase();
    });
}

function extendBoundingBoxFromPath(aabb, elem, pathDesc)
{
    var path = svgpath(pathDesc).unarc().unshort().abs();


    var e = elem;
    while (e && e.tagName !== "svg")
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

                    curX = x;
                    curY = y;

                    aabb.extend(x,y);
                }
                break;
            case "L":
                for (i = 1; i < segment.length; i += 2)
                {
                    x = segment[i];
                    y = segment[i + 1];

                    curX = x;
                    curY = y;
                    aabb.extend(x,y);
                }
                break;
            case "H":

                x = segment[0];
                y = curY;

                curX = x;

                aabb.extend(x,y);
                break;
            case "V":

                x = curX;
                y = segment[0];

                curY = y;

                aabb.extend(x,y);
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
                        //console.log("CONSUME", x1, y1, x2, y2);
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

function extendBoundingBox(aabb, elem)
{
    var tagName = elem.tagName;

    if (tagName === "g")
    {
        var kid = elem.firstChild;
        while (kid)
        {
            extendBoundingBox(aabb, kid);
            kid = kid.nextSibling;
        }
    }
    else if (tagName === "rect")
    {
        extendBoundingBoxFromPath(aabb, elem, pathForRect(elem));
    }
    else if (tagName === "path")
    {
        extendBoundingBoxFromPath(aabb, elem, elem.getAttribute("d"));
    }
}

function postProcess(symbol)
{
    var groups = symbol.groups;
    var transforms = [];
    var aabb = new AABB();
    for (var i = 0; i < groups.length; i++)
    {
        var group = groups[i];
        extendBoundingBox(aabb, group);
        groups[i] = group.innerHTML;

        var elem = group;
        var transformStack = "";
        while (elem && elem.tagName !== "svg")
        {
            var transform = elem.getAttribute("transform");
            if (transform)
            {
                transformStack = transform + " " + transformStack;
            }

            elem = elem.parentNode;
        }
        transforms[i] = trim(transformStack);
    }


    symbol.transforms = transforms;
    symbol.aabb = aabb;
}


function parseStyle(stylesText)
{
    //console.log("STYLE", stylesText);
    var styleRE = /(.*?):(.*?);/g;
    var styles = {};
    var m;
    while (m = styleRE.exec(stylesText))
    {
        var key = dehyphenate(trim(m[1]));
        var value = trim(m[2]);

        var n = +value;

        if (Number.isNaN(n))
        {
            styles[key] = value;
        }
        else
        {
            styles[key] = n;
        }
    }
    return styles;
}

module.exports = function (source)
{
    var parseStyleOption = this.query && this.query.indexOf("\"parseStyle\":true") > 0;

    this.cacheable();
    var done = this.async();

    if (!done)
    {
        throw new Error("This plugin needs to work async.");
    }

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
                            styles: []
                        };
                        symbols[symbolName] = symbol;
                    }

                    symbol.layers.push(layer);
                    symbol.groups.push(group);
                    var style = group.getAttribute("style");

                    if (parseStyleOption)
                    {
                        style = parseStyle(style);
                    }

                    symbol.styles.push(style);
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



