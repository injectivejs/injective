var request = require('supertest');

describe('app', function() {
    beforeEach(function() {
        this.injective = require('../../../lib')(module, require('../injective'));
        return this.injective.import('db').then(function(db) {
            db.connect();
        });
    });

    describe('GET /info', function() {
        it('should display welcome message', function(done) {
            this.injective.import('../lib/app').then(function(app) {
                request(app)
                    .get('/info')
                    .expect(200)
                    .expect('This is a sample server')
                    .end(done);
            }).catch(done);
        });
    });

    describe('GET /user', function() {
        it('should display welcome message for userId=6894', function(done) {
            this.injective.import('../lib/app').then(function(app) {
                request(app)
                    .get('/user?userId=6894')
                    .expect(200)
                    .expect('Hello CY Leung')
                    .end(done);
            }).catch(done);
        });

        it('should display welcome message for userId=9527', function(done) {
            this.injective.import('../lib/app').then(function(app) {
                request(app)
                    .get('/user?userId=9527')
                    .expect(200)
                    .expect('Hello Stephen Chow')
                    .end(done);
            }).catch(done);
        });

        it('should handle user not found', function(done) {
            this.injective.import('../lib/app').then(function(app) {
                request(app)
                    .get('/user?userId=whoami')
                    .expect(200)
                    .expect('Sorry, user not found')
                    .end(done);
            }).catch(done);
        });
    });
});