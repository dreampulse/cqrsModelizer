/// <reference path="../typings/tsd.d.ts"/>
var express = require('express');
var bodyParser = require('body-parser');
var logger = require('morgan');

var Q = require('q');
Q.longStackSupport = true;

var app = express();

app.use(logger('dev'));

app.use(bodyParser.json());

app.put('/createActivity', function (req, res) {
    res.json(req.body);
});

app.listen(3000);
//# sourceMappingURL=pragmaticCqrs.js.map
