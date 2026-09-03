const customerService = require('../services/customer.service');

async function getCustomers(req,res){

try{

const customers = await customerService.getCustomers(
  req.user.storeId
);
return res.json({
 success:true,
 data:customers
});

}catch(error){
return res.status(400).json({
 success:false,
 message:error.message
});

}

}



async function getCustomerById(req,res){

try{

const customer = await customerService.getCustomerById(
 req.params.id,
 req.user.storeId
);


if(!customer){

return res.status(404).json({
 success:false,
 message:'Customer not found'
});

}


return res.json({
success:true,
data:customer
});


}catch(error){

return res.status(400).json({
success:false,
message:error.message
});

}

}



async function createCustomer(req,res){

try{

const customer = await customerService.createCustomer(
 req.body,
 req.user.storeId
);


return res.status(201).json({

success:true,
message:'Customer created successfully',
data:customer

});


}catch(error){

return res.status(400).json({
success:false,
message:error.message
});

}

}




async function updateCustomer(req,res){

try{


const customer = await customerService.updateCustomer(
 req.params.id,
 req.user.storeId,
 req.body
);


return res.json({

success:true,
message:'Customer updated successfully',
data:customer

});


}catch(error){

return res.status(400).json({
success:false,
message:error.message
});

}
}

async function deleteCustomer(req, res) {
  try {
    const customer = await customerService.deleteCustomer(req.params.id, req.user.storeId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    return res.json({ success: true, message: 'Customer moved to trash', data: customer });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

async function getCustomerSales(req,res){
try{
const sales = await customerService.getCustomerSales(req.params.id, req.user.storeId);
return res.json({success:true,data:sales});
}catch(error){
return res.status(400).json({success:false,message:error.message});
}
}

async function createCustomerLedgerShare(req, res) {
try {
const share = await customerService.createCustomerLedgerShare(req.params.id, req.user.storeId);
return res.status(201).json({success:true,data:{token:share.token}});
} catch (error) {
return res.status(error.statusCode || 400).json({success:false,message:error.message});
}
}
async function getPublicCustomerLedger(req, res) {
try {
const ledger = await customerService.getPublicCustomerLedger(req.params.token);
if (!ledger) return res.status(404).json({success:false,message:'Shared ledger link is invalid or expired'});
return res.json({success:true,data:ledger});
} catch (error) {
return res.status(400).json({success:false,message:error.message});
}
}


module.exports={
getCustomers,
getCustomerById,
createCustomer,
updateCustomer,
deleteCustomer,
getCustomerSales
 ,createCustomerLedgerShare
 ,getPublicCustomerLedger
};
