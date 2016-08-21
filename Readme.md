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

The loader will keep track of transformations on that symbol groups and their parents and
will adjust the created offsets accordingly. Translation should always work, rotation and
matrix transforms can cause problems / have to be put at the right level to work. The current
aproach works, but is somewhat primitive.

The loader allows cleanup of namespaces from vector graphic programs like Inkscape (Advertisment: *use Inkscape, it's awesome*)


# Links

[Inkscape: open-source vector graphics editor](https://inkscape.org/)


