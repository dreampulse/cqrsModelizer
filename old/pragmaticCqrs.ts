/// <reference path="../typings/tsd.d.ts"/>

import util = require('util');

import express = require('express');
import bodyParser = require('body-parser');
var logger = require('morgan');

import Q = require('q');
Q.longStackSupport = true;


var app = express();

app.use(logger('dev'));

app.use(bodyParser.json());


app.put('/createActivity', (req : express.Request, res : express.Response) => {

  res.json(req.body);
});

app.listen(3000);