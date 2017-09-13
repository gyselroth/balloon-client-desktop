# Migrations

If there are changes which require a migration add a script SEMVER_VERSION.js to app/migrations.
Eg.: `app/migrations/v0.0.29.js`.

A migration has to export a function. The parameters `previousVersion`, `currentVersion`
and a callback are passed to the migration function.

Eg. `app/migrations/v0.0.29.js`:
```javascript
module.exports = function(previousVersion, currentVersion, done) {
  // added photon cannons for more fire power, but needed to deprecate
  // laser cannons instead.
  // ... add code here ...

  done(null, 'removed laser cannons, added photon cannons.');
}
```

The migrations are applied on each update sequentaly one after each other.
See [app-migrations](https://www.npmjs.com/package/app-migrations) module for more information.
