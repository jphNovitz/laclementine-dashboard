
var app = require('express')();
var http = require('http').Server(app);
var ngrok = require('ngrok')
var io = require('socket.io')(http);
var port = process.env.PORT || 5000;
var serveStatic = require('serve-static');
var redis = require('redis');
//var redisClient = redis.createClient();
const redisAdapter = require('socket.io-redis');
const axios = require('axios');
const table = require('console.table'); 


client = redis.createClient();
io.adapter(redisAdapter({ host: '127.0.0.1', port: 6379 }));

/************************/
/***** start server ****/
/******************** */
http.listen(port, (err) => {
    if (err) return console.log(`Il y a eu une erreur: ${err}`);
                                       
    console.log(",---.|                        |    o          ");
    console.log("|    |    ,---.,-.-.,---.,---.|--- .,---.,---.");
    console.log("|    |    |---'| | ||---'|   ||    ||   ||---'");
    console.log("`---'`---'`---'` ' '`---'`   '`---'``   '`---'");
                                              
    
    console.log('Serveur lance ...');

/*    ngrok.disconnect(port, function (err, url) {
        console.log("ngrok diffuse sur l'url:  ${url}");
    });

ngrok.kill();*/
    ngrok.connect(port, function (err, url) {
        console.log("ngrok diffuse sur l'url:  ${url}");
    });
  });
    

  /************************************************/
  /*************  Get the older orders  **********/
  /******************************************** */

  axios.get('http://v2.jphnovitz.be/api/pending')
  .then(function (response) {
    console.log('recuperation des commandes en attente ...')
    let orders = response.data ;
    
    // clearing  and initializing all
      client.FLUSHALL(function (err, res){
          if (!err){
            console.log(res + ' Orders list is cleared'); 
            orders.forEach(order=>{  
                client.HSET('order:'+order.id, 'order', JSON.stringify(order));
                console.table('\n \nCommande '+ order.id + '===============================================================================', order);
                order.items.forEach(item=>{
                    console.table('Ligne ', item);
                    console.table('PRODUIT: nom  -> slug -> pain -> halal');
                    console.table(item.product.name + ' ('+item.product.slug+') ' + ' '+ item.bread + ' '+ item.halal + ' '+ item.vegetables + ' '  );
                })
                console.table('CLIENT');
                console.table(order.client.firstName + ' ' + order.client.lastName);
              })
          } else {
            console.log('error flush all (redis) ' + err);
          }

      }); 
     
      client.LRANGE('activeItems', 0, -1, function(err, result){
        if(!err){
            io.emit('activeItems', result)
        }
    })

      // end clearing and initializing

    });



  /**********************************************/
 /*******************  Socket IO  **************/
/**********************************************/


io.on('connection', socket => {
    socket.join('order');

    client.KEYS('*order*', function(err, result){
         result.forEach( key=>{
            client.HGET(key, 'order', function(err, rorder){
                if (!err) {
                        console.log(rorder);
                        socket.emit('order', rorder);
                }
            });       
        })
    });

    socket.on('get_orders', function(){
        client.KEYS('*order*', function(err, result){
            result.forEach( key=>{
               client.HGET(key, 'order', function(err, rorder){
                   if (!err) {
                           socket.emit('orders', rorder);
                   }
               });       
           })
       });
    })
    socket.on('new_order', function(val) {
        console.log('===================================================================/n')
        console.log('===================================================================/n')
        console.log('===================================================================/n')
        console.log('===================================================================/n')
        let order = JSON.parse(val.new_order.order)
        client.HSET('order:'+order.id, 'order', JSON.stringify(order));
        io.emit('order', order)
 
    });

    socket.on('remove_order', function(val){
       let id = val.remove_order.id;
       client.HDEL('orders ', id);
       io.emit('remove_order', id)
    });


    socket.on('update_order', function(val){
        client.FLUSHALL(function (err, res){
            if (!err) {
                console.log(' *** UPDATE DONE ' + val.update_order+ ' ***')
                
                io.emit('update_order', val.update_order)
            }
            console.log('erreur');     
        });
     });

     socket.on('activate_order', function(val){
         client.LREM('activeItems', -2, val)
         client.RPUSH('activeItems', val)
         client.LRANGE('activeItems', 0, -1, function(err, result){
             if(!err){
                 console.log(result)
                 io.emit('activeItems', result)
             }
         })
        
         //io.emit('activeItems', list))
      });

      socket.on('desactivate_order', function(val){
        client.LREM('activeItems', -2, val)
        client.LRANGE('activeItems', 0, -1, function(err, result){
            if(!err){
                io.emit('activeItems', result)
            }
        })

      });
      
      socket.on('refresh', ()=>{
        axios.get('http://localhost:8000/api/pending')
        .then(function (response) {
          let orders = response.data ;
          // clearing  and initializing all
            client.FLUSHALL(function (err, res){
                if (!err){
                  console.log(res + ' Orders list is cleared'); 
                  orders.forEach(order=>{  
                      client.HSET('order:'+order.id, 'order', JSON.stringify(order));
                      io.emit('order', order)
                    })
                } else {
                  console.log('error flush all (redis) ' + err);
                }
            }); 
      })
    }); 
});

