var request = require('request');
var cheerio = require('cheerio');
var async = require('async');
var util = require('util');
var fs = require('fs');
var path = require('path');
var S = require('string');

var Imdb = function(){

    var self = this;

    self.host = 'http://www.imdb.com/title/%s/';

    self.url = '';

    self.lang = 'es';

    self.clearString = function( string ){

        return S( S( S( S( string ).trim().s ).stripTags().s ).trim().s ).collapseWhitespace().s;

    }

    self.serializeReleaseDate = function( string ){

        var monthsNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        var monthsNumbers = ["01","02","03","04","05","06","07","08","09","10","11","12"];

        var parts = string.split(' ');

        var index = 0;

        monthsNames.forEach(function(month){
            if( month === parts[1] ){
                parts[1] = monthsNumbers[index];
            }
            index ++

        });

        return parts[2] + '-' + parts[1] + '-' + parts[0];



    }

    self.setId = function( id ){

        self.url = util.format( self.host, id );

    }

    self.getById = function( id, callback ){

        self.setId( id );

        self.getHtml( function( result ){

            self.html = result;
            self.data$ = cheerio.load( result.data );
            self.fullCredits$ = cheerio.load( result.fullcredits );
            self.releaseInfo$ = cheerio.load( result.releaseinfo );
            self.keywords$ = cheerio.load( result.keywords );
            self.plotSummary$ = cheerio.load( result.plotsummary );


            var response = {};

            response.title = self.getInfo( 'title' );

            response.imdb_url = self.getInfo( 'imdb_url' );

            response.genres = self.getInfo( 'genres' );

            response.director = self.getInfo( 'director' );

            response.writers = self.getInfo( 'writers' );

            response.starring = self.getInfo( 'starring' );

            response.producers = self.getInfo( 'producers' );

            response.release_date = self.getInfo( 'release_date' );

            response.plot = self.getInfo( 'plot' );

            response.poster = self.getInfo( 'poster' );

            response.runtime = self.getInfo( 'runtime' );

            response.keywords = self.getInfo( 'keywords' );

            response.mpaa_rating = self.getInfo( 'mpaa_rating' );

            callback( response );

        });

    }

    self.getInfo = function( type ){

        var response = null;

        switch ( type ){

            case 'title':

                response = self.html.data.match( /<title>(.*) \(\d{4}\) - IMDb<\/title>/ )[1] || '';

                break;

            case 'imdb_url':

                response = self.url;

                break;

            case 'original_title':

                response = self.data$('.title-extra').html().split('&quot;')[1] || '';

                break;

            case 'genres':

                var regex = /<a href="\/genre\/(?:.*)" ><span class="itemprop" itemprop="genre">(.*)<\/span><\/a>/ig;

                var rows = [];

                while ( (result = regex.exec(self.html.data)) ) {
                    rows.push(result[1]);
                }

                response = self.translateArray('genre', rows);

                break;

            case 'director':

                response = self.html.data.match( /<meta name="description" content="Directed by (.*)" \/>/)[1].split('.')[0] || '';

                break;

            case 'writers':

                response = self.data$('#overview-top .txt-block').eq(1).html().match( /<a href="(?:.*)" itemprop="url"><span class="itemprop" itemprop="name">(.*)<\/span><\/a>/ig ) || '';

                break;

            case 'starring':

                response = self.data$('#overview-top .txt-block').eq(2).html().match( /<a href="(?:.*)" itemprop="url"><span class="itemprop" itemprop="name">(.*)<\/span><\/a>/ig ) || '';

                break;

            case 'producers':

                response = self.fullCredits$('.dataHeaderWithBorder').eq(3).next().html().match(/<a.*(?=href=\"(?:[^\"]*)\")[^>]*>([^<]*)<\/a>/g) || '';

                break;

            case 'release_date':

                response = self.serializeReleaseDate( S( self.releaseInfo$('#release_dates .odd .release_date').html() ).stripTags().s ) || '';

                break;

            case 'plot':

                response = self.plotSummary$('.plotSummary').text() || '';

                break;

            case 'poster':

                var image = self.data$('#img_primary .image a img').attr('src');

                var parts = image.split('@@');

                response = parts[0] + '@@';

                break;

            case 'runtime':

                 var parts = self.data$('#overview-top .infobar time').text().trim().split(' ');

                response = parts[0] || '';

                break;

            case 'keywords':

                response = self.keywords$('.dataTable').html().match(/<a.*(?=href=\"(?:[^\"]*)\")[^>]*>([^<]*)<\/a>/g);

                break;

            case 'mpaa_rating':

                var mpaa_rating = self.data$('#overview-top .infobar span').eq(0).attr('title');

                response = ( mpaa_rating == undefined ) ? 'PG-13' : mpaa_rating;

                break;

        }

        return self.clearString( response );

    }

    /**
     * Call http request
     * @param callback
     */
    self.getHtml = function( cb ){

        var options = {
            url: self.url,
            headers: {
                'Accept-Language': 'es-ES,es;q=0.8'
            }
        };

        async.parallel({
                data: function(callback){
                    request(options, function (error, response, body){
                        callback(null,body);
                    });
                },
                fullcredits: function(callback){
                    options.url = options.url + 'fullcredits';
                    request(options, function (error, response, body){
                        callback(null,body);
                    });
                },
                releaseinfo: function(callback){
                    options.url = self.url + 'releaseinfo';
                    request(options, function (error, response, body){
                        callback(null,body);
                    });
                },
                plotsummary: function(callback){
                    options.url = self.url + 'plotsummary';
                    request(options, function (error, response, body){
                        callback(null,body);
                    });
                },
                keywords: function(callback){
                    options.url = self.url + 'keywords';
                    request(options, function (error, response, body){
                        callback(null,body);
                    });
                }
            },
            function(err, results) {
                cb( results );
            });

    }

    /**
     * Get list of genres
     * @param callback
     */
    self.getGenres = function( callback ){

        var options = {
            url: 'http://www.imdb.com/genre/',
            headers: {
                'Accept-Language': 'es-ES,es;q=0.8'
            }
        };

        request(options, function (error, response, body){

            var regex = /<h3><a href="(?:.*)">(.*) <span class="normal">&#xBB;<\/span><\/a><\/h3>/gi;

            var rows = [];

            while ( (result = regex.exec(body)) ) {
                rows.push(result[1]);
            }

            callback( rows );

        });

    }

    /**
     * Translate word
     * @param type
     * @param word
     * @returns {string}
     */
    self.translate = function( type, word ){

        var result = '';

        switch ( type ){

            case 'genre':

                var file = fs.readFileSync( path.resolve( __dirname, './genres.json' ), 'utf8');

                var genres = JSON.parse( file );

                var index = 0;

                genres['en'].forEach(function(item){

                    if( item === word ){

                        result = genres[self.lang][index];

                    }

                    index++;

                });

                break;

        }

        return result;

    }

    /**
     * Translate array
     * @param type
     * @param array
     * @returns {Array}
     */
    self.translateArray = function( type, array ){

        var result = [];

        array.forEach( function( word ){

            result.push( self.translate( type, word ) );

        });

        return result;

    }


}

module.exports = Imdb;