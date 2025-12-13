import { useState, useEffect } from "react";
import axios from "axios";
import { supabase } from "../../../supabaseClient";
import { API_BASE_URL } from "../../../../config.js";


export default function TenantMpesaForm() {
  const [tenants, setTenants] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    tenant_id: "",
    paybill_number: "",
    till_number: "",
    consumer_key: "",
    consumer_secret: "",
    passkey: "",
    shortcode: "",
    confirmation_url: "",
    validation_url: "",
    callback_url: "",
  });

  // Fetch tenants from Supabase
  useEffect(() => {
    async function loadTenants() {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name");

      if (error) {
        console.error("Error fetching tenants", error);
        return;
      }

      setTenants(data);
    }

    loadTenants();
  }, []);

  // Form field handler
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Submit MPESA config
 const handleSubmit = async (e) => {
  e.preventDefault();
  setIsLoading(true);

  try {
    await axios.post(
      `${API_BASE_URL}/api/tenant-mpesa-config`,
      formData,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    alert("MPESA configuration saved successfully!");

    // Reset form
    setFormData({
      tenant_id: "",
      paybill_number: "",
      till_number: "",
      consumer_key: "",
      consumer_secret: "",
      passkey: "",
      shortcode: "",
      confirmation_url: "",
      validation_url: "",
      callback_url: "",
    });
  } catch (err) {
    console.error(err);
    alert("Error saving configuration. Please try again.");
  } finally {
    setIsLoading(false);
  }
};


  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-sm  text-slate-600">MPESA Configuration</h1>
          <p className="mt-2 text-gray-600 text-sm">
            Configure MPESA payment settings for your tenants
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-[#586ab1] to-[#6c7dc5]">
            <h2 className="text-xs  text-white">
              Tenant MPESA Configuration
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="p-6 md:p-8">
            {/* Tenant Selection - Full Width */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Tenant *
              </label>
              <select
                name="tenant_id"
                value={formData.tenant_id}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1] focus:border-transparent transition-colors duration-200"
                required
              >
                <option value="" disabled>
                  Choose a tenant...
                </option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id} className="py-2">
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Grid Layout for Inputs - Two per row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Row 1 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paybill Number *
                </label>
                <input
                  type="text"
                  name="paybill_number"
                  placeholder="e.g., 123456"
                  value={formData.paybill_number}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1] focus:border-transparent transition-colors duration-200"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Till Number *
                </label>
                <input
                  type="text"
                  name="till_number"
                  placeholder="e.g., 1234567"
                  value={formData.till_number}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1] focus:border-transparent transition-colors duration-200"
                  required
                />
              </div>

              {/* Row 2 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Consumer Key *
                </label>
                <input
                  type="text"
                  name="consumer_key"
                  placeholder="Enter consumer key"
                  value={formData.consumer_key}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1] focus:border-transparent transition-colors duration-200"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Consumer Secret *
                </label>
                <input
                  type="password"
                  name="consumer_secret"
                  placeholder="Enter consumer secret"
                  value={formData.consumer_secret}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1] focus:border-transparent transition-colors duration-200"
                  required
                />
              </div>

              {/* Row 3 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Passkey *
                </label>
                <input
                  type="password"
                  name="passkey"
                  placeholder="Enter passkey"
                  value={formData.passkey}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1] focus:border-transparent transition-colors duration-200"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shortcode *
                </label>
                <input
                  type="text"
                  name="shortcode"
                  placeholder="Enter shortcode"
                  value={formData.shortcode}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1] focus:border-transparent transition-colors duration-200"
                  required
                />
              </div>

              {/* Row 4 - URL Fields (Full width on mobile, two per row on desktop) */}
              <div className="md:col-span-2">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Webhook URLs</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirmation URL
                    </label>
                    <input
                      type="url"
                      name="confirmation_url"
                      placeholder="https://example.com/confirm"
                      value={formData.confirmation_url}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1] focus:border-transparent transition-colors duration-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Validation URL
                    </label>
                    <input
                      type="url"
                      name="validation_url"
                      placeholder="https://example.com/validate"
                      value={formData.validation_url}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1] focus:border-transparent transition-colors duration-200"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Callback URL *
                    </label>
                    <input
                      type="url"
                      name="callback_url"
                      placeholder="https://example.com/callback"
                      value={formData.callback_url}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1] focus:border-transparent transition-colors duration-200"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={isLoading}
                className="px-8 py-3 bg-gradient-to-r from-[#586ab1] to-[#6c7dc5] text-white font-medium rounded-lg hover:from-[#4a5a9a] hover:to-[#5a6ab0] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#586ab1] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  "Save Configuration"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Note:</h3>
          <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
            <li>Fields marked with * are required</li>
            <li>Ensure all URLs are HTTPS for production use</li>
            <li>Keep your Consumer Secret and Passkey secure</li>
          </ul>
        </div>
      </div>
    </div>
  );
}