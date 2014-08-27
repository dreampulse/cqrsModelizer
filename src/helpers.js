/// <reference path="../typings/tsd.d.ts"/>
var Q = require('q');
Q.longStackSupport = true;

var cqrs = require('./cqrs');

var MongoCURDProjection = (function () {
    function MongoCURDProjection(name, db, domainEventCreated, domainEventUpdated, domainEventDeleted) {
        this.name = name;
        this.projection = new cqrs.MongoProjection(name, db, function (collection) {
            domainEventCreated.handle(function (eventParams, user) {
                var doc = eventParams;
                doc.owner = user._id;

                collection.insert(doc);
            });

            domainEventUpdated.handle(function (eventParams, user) {
                var doc = eventParams;
                doc.owner = user._id;

                collection.update({
                    _id: doc._id,
                    owner: user._id
                }, doc);
            });

            domainEventDeleted.handle(function (objId, user) {
                collection.remove({
                    _id: objId._id,
                    owner: user._id
                });
            });
        });
    }
    MongoCURDProjection.prototype.query = function (params) {
        return this.projection.query(params);
    };
    return MongoCURDProjection;
})();
exports.MongoCURDProjection = MongoCURDProjection;
//# sourceMappingURL=helpers.js.map
