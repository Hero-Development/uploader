
'use strict';

const path = require('node:path');
const { fileURLToPath } = require('node:url');

const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const multer = require('multer');


let logging = console;

// TODO: config from ENV
const rootPath = path.dirname(path.dirname(__dirname));




const app = express();


// enable CORS requests
app.use(cors());

// enable JSON parsing
app.use(bodyParser.json());

// enable parsing GET params
app.use(bodyParser.urlencoded({ extended: false }));

// front-ware for troubleshooting
app.use(( req, res, next ) => {
  let request = req.method.toUpperCase() +' '+ req.url;
  if( Object.keys( req.body ).length ){
    request += "\r\n"+ JSON.stringify(req.body);
  }

  logging.info(`--------------------------------------------------------------\nRequest: ${request}`);
  next();
});


app.get( '/test', (req, res, next) => {
  logging.log('Sending a pizza...');

  res.status(200)  //set the HTTP status code
    .type('json')  //set the JSON headers
    .send({ 
      pizza: {
        size: 'XL',
        toppings: [
          'tomato sauce',
          'cheese',
          'pepperoni',
          'pinapple'
        ]
      }
    });
});


// TODO: config from ENV
const uploadPath = path.join(__dirname, 'uploads');
const filesHelper = multer({
  fileFilter: (req, file, cb) => {
    cb(null, true);
  },
  limits: {
    // 2^23 + 2^21 = ~10 mib
    fileSize: 10_485_760
  },
  storage: multer.diskStorage({
    destination: function(req, file, cb){
      cb(null, uploadPath)
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() +'-'+ file.originalname)
    }
  })
});


const loadMultipartFile = async (req, res, fieldName) => {
  return new Promise(async (resolve, reject) => {
    const helper = filesHelper.single(fieldName);

    // overwrite the next() handler and check for error
    helper(req, res, (err) => {
      if(err){
        logger.warn({err});
        reject(err);
      }
      else{
        resolve(req.file);
      }
    });
  });
};


app.post('/upload', async (req, res, next) => {
  try{
    const file = await loadMultipartFile(req, res, 'file');
    // TODO: check size
    // TODO: check extension
    // TODO: check mimetype

    res.status(202)
      .json({
        filename: file.originalname
      })
      .end()
  }
  catch(err) {
    logging.error(err);
    next(err);
  }
});


// end-ware for unhandles requests, add last
// TODO: use this to reload vite
app.use(( req, res, next ) => {
  let request = req.method.toUpperCase() +' '+ req.url
  if(Object.keys(req.body).length){
    request += "\r\n"+ JSON.stringify(req.body);
  }

  logging.warn( `UNHANDLED REQUEST: ${request}` )
  res.status(404)
    .type('json')
    .send({ 
      error: 'Route not found'
    });
});


// end-ware for errors, add last
app.use((err, req, res, next) => {
  let request = req.method.toUpperCase() +' '+ req.url;
  if(Object.keys(req.body).length){
    request += "\r\n"+ JSON.stringify(req.body);
  }

  logging.error({
    REQUEST: request,
    ERROR: err
  });

  res.status(500)
    .type('json')
    .send({ 
      error: 'Server Error'
    });
});

// TODO: port from ENV
//start the server on port 8000
app.listen(8000, function(){
  logging.info(`Express.js listening on port 8000`);
});
