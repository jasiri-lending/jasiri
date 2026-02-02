/**
 * Base template for all system emails.
 * Provides a professional container with header and footer.
 */
export const baseEmailTemplate = (title, content) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f7f6; font-family: 'Segoe UI', Arial, sans-serif;">
    <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e0e0e0;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #2E5E99 0%, #1a3a5f 100%); padding: 30px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">Jasiri</h1>
            <p style="color: #cbd5e0; margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Securing Your Future</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px; line-height: 1.6; color: #334e68;">
            <h2 style="color: #1a365d; margin-top: 0; font-size: 22px; border-bottom: 2px solid #edf2f7; padding-bottom: 15px; margin-bottom: 25px;">${title}</h2>
            ${content}
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 25px 30px; text-align: center; border-top: 1px solid #edf2f7; color: #718096; font-size: 13px;">
            <p style="margin: 0 0 10px 0;">&copy; ${new Date().getFullYear()} Jasiri SaaS. All rights reserved.</p>
            <div style="margin-bottom: 10px;">
                <a href="#" style="color: #2E5E99; text-decoration: none; margin: 0 10px;">Support Center</a> | 
                <a href="#" style="color: #2E5E99; text-decoration: none; margin: 0 10px;">Privacy Policy</a>
            </div>
            <p style="margin: 0; font-style: italic;">If you didn't expect this email, please ignore it or contact our support team if you have concerns.</p>
        </div>
    </div>
</body>
</html>
`;

/**
 * Gradient box for highlighting verification codes or passwords.
 */
export const styledHighlightBox = (text) => `
<div style="text-align: center; margin: 35px 0;">
    <div style="background: linear-gradient(135deg, #2E5E99 0%, #586ab1 100%); 
        color: #ffffff; padding: 18px 35px; border-radius: 14px; display: inline-block; 
        font-size: 32px; letter-spacing: 8px; font-weight: 800; font-family: 'Courier New', monospace;
        box-shadow: 0 10px 20px rgba(46, 94, 153, 0.25); text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        ${text}
    </div>
</div>
`;

/**
 * Informational box for warnings or important steps.
 */
export const infoBox = (content, title = "Important Note") => `
<div style="background-color: #fffaf0; border-left: 5px solid #f6ad55; padding: 15px 20px; margin: 25px 0; border-radius: 4px;">
    <p style="margin: 0; color: #9c4221;"><strong>${title}:</strong> ${content}</p>
</div>
`;
