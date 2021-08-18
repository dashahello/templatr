#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const readline = require('readline');

/**
 * Globals
 */
const HTTPS_OPTIONS = {
  key: fs.readFileSync(`${__dirname}/../SSL/key.pem`),
  cert: fs.readFileSync(`${__dirname}/../SSL/cert.pem`)
};
const RESULTS_DIRECTORY = `${__dirname}/../results`;
const PORT = process.env.PORT || 3000;

/**
 * Pipe stdin/stdout to readline.createInterface
 */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const isWindows = process.platform === 'win32';

/**
 * Helper function to get file name from a file location string
 * @param {string} path
 * @returns {string} File name
 * @example
 * const fileLocation = getFileNameFromPath('/hello/world/test.json');
 * console.log(fileLocation); // test.json
 */
function getFileNameFromPath(path) {
  const pathSplit = path.split(isWindows ? '\\' : '/');
  return pathSplit[pathSplit.length - 1];
}

/**
 * Generates a template result. If a template variable value is not found in the data
 * object, it will be replaced with an empty string ('')
 * @param {string} template
 * @param {object} data
 * @returns {string} Transformed template string with replaced values from data object
 * @example
 * const result = generateTemplate(
 *  'Temerature is %temperature%',
 *  { temperature: 20 }
 * );
 */
function generateTemplate(template, data) {
  const regex = /%[^\s.]+?%/gm;

  const matches = template.match(regex) || [];

  for (let match of matches) {
    const key = match.slice(1, match.length - 1);
    const value = data[key] === undefined ? '' : data[key];
    template = template.replace(match, value);
  }

  return template;
}

/**
 * Async helper function to ask questions in a terminal
 * @param {string} question
 * @returns {Promise}
 * @example
 * const age = await askQuestion('How old are you?');
 */
const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question('\n' + question, (answer) => resolve(answer.trim()));
  });
};

/**
 * Helper function to read a file from filesystem and convert it to a string
 * @param {string} filePath Location of the file
 * @returns {string} File content
 * @example
 * const fileContent = readTemplateFile('/some/file/location');
 * console.log(typeof fileContent); // string
 */
function readTemplateFile(filePath) {
  return fs.readFileSync(filePath).toString();
}

/**
 * Helper function to read and parse a JSON file
 * @param {string} filePath Location of a JSON file
 * @returns {object} Object parsed from JSON file
 * @example
 * const data = readDataFile('/some/file/location');
 * console.log(typeof data); // object
 */
function readDataFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath));
}

/**
 * Helper function to write to a file, and call onError on error
 * @param {string} fileName Name of the template file
 * @param {string} content New file content
 * @example
 * writeFile('/some/file/location/test.html', '<p>HI</p>', () => {
 *   console.log('On error callback called');
 * });
 */
function writeFile(fileLocation, content, onError) {
  try {
    fs.writeFileSync(fileLocation, content);
  } catch (error) {
    console.log('Could not create file!');
    if (onError) onError();
  }
}

/**
 * Called to ask questions and generate template results
 * @param {object} - Optional object, which maintains previous run state
 *                   in order not to ask correctly answered questions again
 */
async function run({ template, templateFileLocation } = {}) {
  if (!template && !templateFileLocation) {
    templateFileLocation = await askQuestion('Enter template file location: ');

    if (
      templateFileLocation === '' ||
      !templateFileLocation.includes('.html')
    ) {
      console.log('Template file should be of type html!');
      return run();
    } else {
      try {
        template = readTemplateFile(templateFileLocation);
      } catch (error) {
        console.log(`File '${templateFileLocation}' not found!`);
        return run();
      }
    }
  }

  const templateFileName = getFileNameFromPath(templateFileLocation);

  const dataFileLocation = await askQuestion('Enter data file location: ');

  let data;
  if (dataFileLocation === '' || !dataFileLocation.includes('.json')) {
    console.log('Data file should be of type JSON!');
    return run({
      template,
      templateFileLocation
    });
  } else {
    try {
      data = readDataFile(dataFileLocation);
    } catch (error) {
      if (error.name === 'SyntaxError') {
        console.log(`File '${dataFileLocation}' is invalid JSON!`);
      } else {
        console.log(`File '${dataFileLocation}' not found!`);
      }

      return run({
        template,
        templateFileLocation
      });
    }
  }

  const newContent = generateTemplate(template, data);

  writeFile(`${RESULTS_DIRECTORY}/${templateFileName}`, newContent, run);

  console.log(
    `New file is served on https://localhost:${PORT}/${templateFileName}`
  );

  run();
}

run();

/**
 * Generates a simple index HTML page, an anchor tag for each item in a directory
 * (ignoring .gitignore)
 * Only to be used for top level files (no recursive directory reading)
 * @param {string} directory Directory to create an index for
 * @returns {string} Generated index HTML
 * @example
 * const index = await generateIndex('/some/directory');
 */
function generateIndex(directory) {
  return new Promise((resolve, reject) => {
    fs.readdir(directory, (err, files) => {
      files = files.filter((file) => file !== '.gitignore');
      if (err) return reject(err);
      resolve(`<html><body>
      ${
        files.length === 0
          ? 'No files found!'
          : files
              .map(
                (file) =>
                  `<a href="https://localhost:${PORT}/${file}">${file}</a><br />`
              )
              .join('')
      }
      </body></html>`);
    });
  });
}

/**
 * Helper function to end a response as HTML with status code 200
 * @param {object} res httpServerResponseObject
 * @param {string} html
 * @example
 * serveHtml(httpServerResponseObject, '<p>HI!</p>');
 */
function serveHtml(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

/**
 * Called for every incoming https request.
 * If the requested url is the root of the domain ( / ) serve a simple index
 * with links to top level files in `RESULTS_DIRECTORY`
 * @param {object} req HTTP(s) server request object
 * @param {object} res HTTP(s) server response object
 */
async function httpsRequestHandler(req, res) {
  if (req.url === '/') {
    try {
      const index = await generateIndex(RESULTS_DIRECTORY);
      serveHtml(res, index);
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Could not generate index');
    }
  } else {
    try {
      serveHtml(res, fs.readFileSync(`${RESULTS_DIRECTORY}/${req.url}`));
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found!');
    }
  }
}

/**
 * Set up HTTPS server and listen on `PORT`
 */
https.createServer(HTTPS_OPTIONS, httpsRequestHandler).listen(PORT);

// /home/d/dev/templatr/examples/template.html
// /home/d/dev/templatr/examples/data.json
