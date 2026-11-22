/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: "widget",
  name: "WishlistWidget",
  bundleIdentifier: "com.calebsiegel.wishlist.widget",
  entitlements: {
    "com.apple.security.application-groups": ["group.com.calebsiegel.wishlist"],
  },
};
