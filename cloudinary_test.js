const cloudinary = require('cloudinary').v2;

// 1. Configure Cloudinary inline using collected credentials
cloudinary.config({
  cloud_name: 'edzrui30',
  api_key: '483934595555873',
  api_secret: '0FrxIth_C4lQLwyXecP10F3DphE'
});

async function runOnboarding() {
  try {
    console.log('Starting Cloudinary onboarding...\n');
    
    // 2. Upload sample image from demo domains
    const sampleImageUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
    console.log(`Uploading sample image from: ${sampleImageUrl}`);
    
    const uploadResult = await cloudinary.uploader.upload(sampleImageUrl, {
      folder: 'onboarding_demo'
    });
    
    console.log('Upload successful!');
    console.log(`Secure URL: ${uploadResult.secure_url}`);
    console.log(`Public ID: ${uploadResult.public_id}\n`);
    
    // 3. Get image details from metadata
    console.log('--- Image Metadata ---');
    console.log(`Width: ${uploadResult.width}px`);
    console.log(`Height: ${uploadResult.height}px`);
    console.log(`Format: ${uploadResult.format}`);
    console.log(`File Size: ${uploadResult.bytes} bytes\n`);
    
    // 4. Transform the image
    // Generate optimized version using f_auto and q_auto
    const transformedUrl = cloudinary.url(uploadResult.public_id, {
      // f_auto (fetch_format: 'auto') delivers the best format for the user's browser (e.g. WebP or AVIF)
      fetch_format: 'auto',
      // q_auto (quality: 'auto') automatically optimizes image compression and quality
      quality: 'auto',
      secure: true
    });
    
    console.log('==================================================');
    console.log('Done! Click link below to see optimized version of the image. Check the size and the format.');
    console.log(transformedUrl);
    console.log('==================================================');
    
  } catch (error) {
    console.error('Onboarding script failed:', error);
  }
}

runOnboarding();
