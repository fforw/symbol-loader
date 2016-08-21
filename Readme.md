# Webpack symbol loader

A webpack loader to extract graphical symbols from SVG documents to be used within a web context
(e.g. React).

## Symbols

A symbol is basically an named array of SVG groups. To define a symbol, you need to 
create a SVG <g/> element with the id set in a special format

```HTML
<g id="symbol:name">
    ...
</g>
```

This defines a symbol group with the name "name". The symbol names can be any valid id character but ":".
You can define symbol layers by adding another colon separated identifier


```HTML
<g id="symbol:name:layer1">
    ...
</g>
<g id="symbol:name:layer2">
    ...
</g>
<g id="symbol:name:layer3">
    ...
</g>
```

Here, the symbol "name" consist of three different layers, to be drawn in document definition order
as usual with SVG.

The loader will ignore all transforms outside of the symbol groups and on the group itself. 

The loader will convert the symbols into a JSON structure which is exported as module export
in the generated module.


```Javascript
module.exports = {
    "symbolName": {
        "name": "symbolName",
        "layers": [
            "layerName"
        ],
        "groups": [
            "<circle cx=\"0\" cy=\"0\" r=\"100\"/>"
            // ... one SVG snippet per layer ...
        ],
        "styles": [
            "fill: #0f0;"
            // ... one SVG CSS style string per layer ...
        ],
        "center": {
            "x": 50,
            "y": 50
        }
    }
}
```

The center object contains the center of the calculated bounding box. Paths are linearized to 
determine a good aproximation of the bounding box. 

# Links

[Inkscape: open-source vector graphics editor](https://inkscape.org/)


