import { Schema,model } from "mongoose";

const postSchema = new Schema({
  title:{type:String,required:true},
  category:{type:String,enum:['Agriculture','Technology','Business','Art','Entertainment','Investment','Food','Education','Weather','Uncategorized'],message:'{value} is not supported'},
  authorId:{type:Schema.Types.ObjectId,ref : "User"},
  description:{type:String,required:true},
  thumbnail:{type:String,required:true}
},{timestamps:true})

const Post = model("Post",postSchema);

export default Post;