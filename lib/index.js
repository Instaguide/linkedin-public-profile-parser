var fetcher = require('./fetcher');
var parser  = require('./profile');

module.exports = function(url, next) {
  fetcher(url, function(err, responseData, html){

    if( err ){
      return next(err, {data: responseData});
    }

    parser(responseData.url, html, function(err, data){
      return next(err, data);
    })
  })
};
