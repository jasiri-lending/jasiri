// AvatarRouter.js - CORRECTED VERSION
import express from "express";
import { supabase, supabaseAdmin } from '../supabaseClient.js';
import multer from "multer";
import path from "path";
import fs from "fs";

const AvatarRouter = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = '/tmp/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP)'));
    }
  }
});

// Middleware to verify session token
const verifySession = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No session token provided' });
    }

    const sessionToken = authHeader.split(' ')[1];
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("session_token", sessionToken)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Invalid session token' });
    }

    // Check if session expired
    const now = new Date();
    const expiry = new Date(user.session_expires_at);
    if (expiry.getTime() < now.getTime()) {
      return res.status(401).json({ success: false, error: 'Session expired' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Session verification error:", err);
    res.status(500).json({ success: false, error: 'Session verification failed' });
  }
};

// POST /api/upload-avatar - upload user avatar
AvatarRouter.post("/upload-avatar", verifySession, upload.single('avatar'), async (req, res) => {
  try {
    console.log("📤 Avatar upload request received");
    console.log("  - User ID:", req.user.id);
    console.log("  - User Email:", req.user.email);

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const userId = req.user.id;
    const file = req.file;

    console.log("  - File info:", {
      originalName: file.originalname,
      size: (file.size / 1024).toFixed(2) + " KB",
      mimetype: file.mimetype
    });

    // Get file extension and create storage path
    const fileExt = path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    const fileName = `${timestamp}${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    console.log("  - Storage path:", filePath);

    // Check if user has existing avatar and delete it
    const { data: existingProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("avatar_url, branch_id, region_id, tenant_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.warn("⚠️ Profile fetch error:", profileError);
    }

    if (existingProfile?.avatar_url) {
      try {
        const urlParts = existingProfile.avatar_url.split('/avatars/');
        if (urlParts.length > 1) {
          const oldPath = urlParts[1].split('?')[0];
          console.log("🗑️ Deleting old avatar:", oldPath);

          const { error: deleteError } = await supabaseAdmin.storage
            .from('avatars')
            .remove([oldPath]);

          if (deleteError) {
            console.warn('⚠️ Could not delete old avatar:', deleteError.message);
          } else {
            console.log("✅ Old avatar deleted successfully");
          }
        }
      } catch (deleteError) {
        console.warn('⚠️ Error during old avatar deletion:', deleteError);
      }
    }

    // Read the file from disk
    const fileBuffer = fs.readFileSync(file.path);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(filePath, fileBuffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: true
      });

    // Clean up temporary file
    fs.unlinkSync(file.path);

    if (uploadError) {
      console.error("❌ Upload error:", uploadError);
      return res.status(400).json({
        success: false,
        error: uploadError.message || 'Failed to upload file'
      });
    }

    console.log("✅ File uploaded successfully:", uploadData);

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(filePath);

    console.log("🔗 Public URL generated:", publicUrl);

    // Use upsert to handle both insert and update for profiles table
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        avatar_url: publicUrl,
        // Preserve existing data if any
        ...(existingProfile && {
          branch_id: existingProfile.branch_id,
          region_id: existingProfile.region_id,
          tenant_id: existingProfile.tenant_id
        })
      }, {
        onConflict: 'id'
      });

    if (profileUpdateError) {
      console.error("❌ Profile update error:", profileUpdateError);
      return res.status(500).json({
        success: false,
        error: profileUpdateError.message || 'Failed to update profile'
      });
    }

    console.log("✅ Profile table updated with avatar_url");

    console.log("🎉 Avatar upload complete for user:", req.user.email);

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      url: publicUrl,
      data: {
        path: filePath,
        publicUrl: publicUrl
      }
    });

  } catch (error) {
    console.error("💥 Avatar upload crash:", error);

    // Clean up temporary file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error("Failed to clean up temp file:", unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload avatar'
    });
  }
});

// DELETE /api/delete-avatar - delete user avatar
AvatarRouter.delete("/delete-avatar", verifySession, async (req, res) => {
  try {
    console.log("🗑️ Avatar deletion request received");
    console.log("  - User ID:", req.user.id);
    console.log("  - User Email:", req.user.email);

    const userId = req.user.id;

    // Get current avatar URL
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("avatar_url, branch_id, region_id, tenant_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("❌ Profile fetch error:", profileError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch profile'
      });
    }

    // Delete from storage if avatar exists
    if (profile?.avatar_url) {
      try {
        const urlParts = profile.avatar_url.split('/avatars/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1].split('?')[0];
          console.log("🗑️ Deleting avatar file:", filePath);

          const { error: deleteError } = await supabaseAdmin.storage
            .from('avatars')
            .remove([filePath]);

          if (deleteError) {
            console.warn('⚠️ Could not delete avatar file:', deleteError.message);
          } else {
            console.log("✅ Avatar file deleted from storage");
          }
        }
      } catch (deleteError) {
        console.warn('⚠️ Error deleting avatar file:', deleteError);
      }
    }

    // Update profiles table to clear avatar_url while preserving other data
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        avatar_url: null,
        // Preserve existing data
        branch_id: profile?.branch_id || null,
        region_id: profile?.region_id || null,
        tenant_id: profile?.tenant_id || null
      }, {
        onConflict: 'id'
      });

    if (profileUpdateError) {
      console.error("❌ Profile update error:", profileUpdateError);
      return res.status(500).json({
        success: false,
        error: profileUpdateError.message || 'Failed to update profile'
      });
    }

    console.log("✅ Profile avatar_url cleared");

    console.log("🎉 Avatar deletion complete for user:", req.user.email);

    res.json({
      success: true,
      message: 'Avatar deleted successfully'
    });

  } catch (error) {
    console.error("💥 Avatar deletion crash:", error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete avatar'
    });
  }
});

export default AvatarRouter;