/// <reference path="../typings/tsd.d.ts" />
var assert = require("assert");

var cqrs = require("../src/cqrs");

describe("StatefulEventProvider", function () {
    it("should emit and handle an event", function () {
        var myEventProvider = new cqrs.StatefulEventProvider("exampleEventName");

        var wasHandeled = false;
        myEventProvider.handle(function (e, state) {
            assert.equal(e.payload, "bar");
            assert.equal(state.user, "test user");

            wasHandeled = true;
        });

        myEventProvider.emit({
            payload: "bar"
        }, {
            user: 'test user'
        });

        assert.equal(wasHandeled, true);
    });
});
//# sourceMappingURL=StatefulEventProvider.spec.js.map
