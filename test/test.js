var Imdb = require('../lib/imdb');
var imdb = new Imdb();

imdb.lang = 'es';

imdb.getById( 'tt0458525', function(response){

    console.log( response );

});