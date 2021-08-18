# templatr

## Description

templatr is a command line application which lets you put a a dynamic content into a static HTML file using simple templating engine.

## Usage

### Example

Template html file

```html
<p>Hello %name%!</p>
```

Data json file

```json
{
  "name": "Dasha"
}
```

Generated result

```html
<p>Hello Dasha!</p>
```

Check the examples directory for another (bigger) example.

### Project usage

1. Clone repository `git clone https://github.com/dashahello/templatr`
2. Go to cloned directory in terminal `cd templatr`
3. (optional) npm install -g templatr
4. Give location of template html file (for example the `template.html` in the examples directory)
5. Give location of data JSON file (for example the `data.json` in the examples directory)
6. Browse to `https://localhost:3000` to view the results index or browse to the url logged in the terminal

## Requirements

templatr requires the following to run:

- Node.js (version 14.16.1 was used for developing)
- npm (normally comes with Node.js)

## Documentation

Run `npm install` to install dev-dependencies and then run `npm run doc` to generate (jsdoc) documentation.
The documentation is generated to `./doc/jsdoc`.
