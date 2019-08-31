import * as Two from '../node_modules/two.js/build/two.js';

export function pathFromAnchors(anchors, leftHandles, rightHandles) {
  // TODO: errorcheck lengths
  let vertices = [];
  for (let i = 0; i < anchors.length; i++) {
    vertices.push(new Two.Anchor(
      anchors[i][0],
      anchors[i][1],
      leftHandles[i][0],
      leftHandles[i][1],
      rightHandles[i][0],
      rightHandles[i][1],
      'C',
    ));
  }
  vertices.forEach(v => v.relative = false);
  let path = new Two.Path(
    vertices,
    /*closed=*/false,
    /*curved=*/true,
    /*manual=*/true,
  );
  path.cap = 'square';
  return path;
}

export function pathFromPoints(points) {
  let np = window.pyodide.pyimport("numpy");
  let interpolation = [];
  for (let a of np.linspace(0, 1, 4)) {
    interpolation.push(interpolateMatrices(
      points,
      points.slice(1).concat([points[0]]),
      a,
    ));
  }

  let args = [];
  args.push(interpolation[0]);
  args.push([interpolation[2][points.length - 1]].concat(interpolation[2].slice(0, -1)));
  args.push(interpolation[1]);
  // close the polygon
  args.forEach(arg => arg.push(arg[0]));
  return pathFromAnchors(args[0], args[1], args[2]);
}

export function scalePath(factor, path) {
  for (let v of path.vertices) {
    v.multiplyScalar(factor);
    v.controls.left.multiplyScalar(factor);
    v.controls.right.multiplyScalar(factor);
  }
}

export function translatePath(vector, path) {
  let vec = new Two.Vector(vector[0], vector[1]);
  if (path.vertices)
  for (let v of path.vertices) {
    v.addSelf(vec);
    v.controls.left.addSelf(vec);
    v.controls.right.addSelf(vec);
  }
}

export function interpolate(start, end, alpha) {
    return (1 - alpha) * start + alpha * end;
}

export function interpolateArrays(arr1, arr2, alpha) {
  let ret = [];
  for (let i = 0; i < arr1.length; i++) {
    ret.push((1 - alpha) * arr1[i] + alpha * arr2[i]);
  }
  return ret;
}

export function interpolateMatrices(m1, m2, alpha) {
  let ret = [];
  for (let i = 0; i < m1.length; i++) {
    ret.push(interpolateArrays(m1[i], m2[i], alpha));
  }
  return ret;
}

export function getManimPoints(mobject) {
  let ret = [];
  let length = mobject.children[0].vertices.length;
  for (let i = 0; i < length - 1; i++) {
    let curV = mobject.children[0].vertices[i];
    let nextV = mobject.children[0].vertices[i + 1];
    ret.push([curV.x, curV.y]);
    ret.push([curV.controls.right.x, curV.controls.right.y]);
    ret.push([nextV.controls.left.x, nextV.controls.left.y]);
    ret.push([nextV.x, nextV.y]);
  }
  return ret;
}

let CHOOSE_CACHE = [[1]];

export function choose(n, k) {
  if (CHOOSE_CACHE.length > n && CHOOSE_CACHE[n].length > k) {
    return CHOOSE_CACHE[n][k];
  }

  // find the first incomplete row
  let i;
  for (i = 0; i < Math.min(CHOOSE_CACHE.length, n+1); i++) {
    if (CHOOSE_CACHE[i].length < Math.min(k+1, i+1)) {
      break;
    }
  }

  for (; i < n+1; i++) {
    if (i === CHOOSE_CACHE.length) {
      CHOOSE_CACHE.push([1]);
    }
    // complete the row
    let j;
    for (j = CHOOSE_CACHE[i].length; j < Math.min(k+1, i+1); j++) {
      CHOOSE_CACHE[i].push(
        (CHOOSE_CACHE[i-1][j-1] !== undefined ? CHOOSE_CACHE[i-1][j-1] : 0) +
        (CHOOSE_CACHE[i-1][j] !== undefined ? CHOOSE_CACHE[i-1][j] : 0)
      );
    }
  }
  return CHOOSE_CACHE[n][k];
}

export function bezier(points) {
  let n = points.length - 1;
  let f = function(t) {
    let ret = [0, 0, 0];
    for (let k = 0; k < points.length; k++) {
      let point = points[k];
      ret[0] += ((1 - t)**(n - k)) * (t**k) * choose(n, k) * point[0]
      ret[1] += ((1 - t)**(n - k)) * (t**k) * choose(n, k) * point[1]
    }
    return ret;
  };
  return f;
}

export function partialBezierPoints(curveStart, curveEnd, alpha1, alpha2) {
  let points = [
    [curveStart.x, curveStart.y],
    [curveStart.controls.right.x, curveStart.controls.right.y],
    [curveEnd.controls.left.x, curveEnd.controls.left.y],
    [curveEnd.x, curveEnd.y],
  ];

  if (alpha1 === 1) {
    let ret = [];
    for (let i = 0; i < 4; i++) {
      ret.push(points[points.length - 1]);
    }
    return ret;
  }

  let aTo1 = [];
  for (let i = 0; i < points.length; i++) {
    aTo1.push(bezier(points.slice(i))(alpha1));
  }
  let endProp = (alpha2 - alpha1) / (1 - alpha1);
  let ret = [];
  for (let i = 0; i < points.length; i++) {
    ret.push(bezier(aTo1.slice(0, i + 1))(endProp));
  }
  return ret;
}

export function sigmoid(x) {
  let np = window.pyodide.pyimport("numpy");
  return 1.0 / (1 + np.exp(-x));
}

export function smooth(t, inflection=10) {
  let np = window.pyodide.pyimport("numpy");
  let error = sigmoid(-inflection / 2);
  return np.clip(
    (sigmoid(inflection * (t - 0.5)) - error) / (1 - 2 * error),
    0,
    1,
  );
}
