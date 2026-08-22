const prisma = require('../config/prisma');


async function getCustomers(storeId){

return prisma.customer.findMany({
where:{
storeId
},
orderBy:{
createdAt:'desc'
}
});

}



async function getCustomerById(customerId,storeId){

return prisma.customer.findFirst({
where:{
id:customerId,
storeId
}
});

}



async function createCustomer(data,storeId){

const {
name,
phone,
alternatePhone,
email,
gstin,
address,
city,
state,
pincode,
creditLimit,
creditDays,
openingBalance
}=data;


if(!name){
throw new Error('Customer name is required');
}


return prisma.customer.create({

data:{
storeId,
name,
phone:phone || null,
alternatePhone:alternatePhone || null,
email:email || null,
gstin:gstin || null,
address:address || null,
city:city || null,
state:state || null,
pincode:pincode || null,
creditLimit:creditLimit || 0,
creditDays:creditDays || 0,
openingBalance:openingBalance || 0
}

});


}



async function updateCustomer(customerId,storeId,data){

const customer = await prisma.customer.findFirst({
where:{
id:customerId,
storeId
}
});


if(!customer){
throw new Error('Customer not found');
}


return prisma.customer.update({

where:{
id:customerId
},

data

});

}



module.exports={
getCustomers,
getCustomerById,
createCustomer,
updateCustomer
};
