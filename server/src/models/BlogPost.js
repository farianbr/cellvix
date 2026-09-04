import mongoose from 'mongoose';

const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    excerpt: { type: String, required: true },
    // Plain text in the tiny markup vocabulary the client renderer understands.
    // Storing HTML would mean trusting it at render time; this cannot be injected.
    body: { type: String, required: true },

    category: { type: String, required: true, index: true },
    tags: [String],
    coverImage: String,

    author: {
      name: { type: String, required: true },
      role: String,
    },

    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    publishedAt: { type: Date, index: true },
    isFeatured: { type: Boolean, default: false },

    // Derived on save from the body's word count — never authored, so it cannot
    // drift from the text it describes.
    readMinutes: { type: Number, default: 1 },
  },
  { timestamps: true },
);

blogPostSchema.index({ title: 'text', excerpt: 'text', tags: 'text' });
blogPostSchema.index({ status: 1, publishedAt: -1 });

const BlogPost = mongoose.model('BlogPost', blogPostSchema);

export { BlogPost };
export default BlogPost;
