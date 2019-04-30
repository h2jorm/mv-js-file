# MV JS FILE

Move a JS file from source to destination and fix related import references automatically.


## Example

The origin files are

```
// src/components/A.js
const A = {};
export default A;

// src/components/B.js
import A from '@components/A.js';
const B = () => (<A />);
export default B;
```

Use code:

```
const mvJsFile = require('mv-js-file');
const path = require('path');

mvJsFile(path.resolve('src/components/A.js'), path.resolve('src/components/NewA.js'), {
  root: process.cwd(),
  aliases: {
    '@components': path.resolve('src/components'),
  },
});
```

And now:

``` diff
// src/components/A.js
- const A = {};
- export default A;

// src/components/NewA.js
+ const A = {};
+ export default A;

// src/components/B.js
- import A from '@components/A.js';
+ import A from '@components/NewA.js';
const B = () => (<A />);
export default B;
```