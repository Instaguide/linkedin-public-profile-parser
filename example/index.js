var lp = require('../lib/');
var url = 'https://www.linkedin.com/in/satishkaushik174';
lp(url, function(err, data){
  console.log(JSON.stringify(data,null,2));
});
