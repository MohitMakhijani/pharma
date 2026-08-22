const service = require('../services/salesReturn.service');


async function createSalesReturn(req,res){

try{

const data =
await service.createSalesReturn({

storeId:req.user.storeId,

saleId:req.params.saleId,

items:req.body.items,

reason:req.body.reason

});


res.status(201).json({
success:true,
message:'Sales return created',
data
});


}catch(error){

res.status(400).json({
success:false,
message:error.message
});

}

}


module.exports={
createSalesReturn
};
