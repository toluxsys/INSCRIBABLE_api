function sort(arr) {
  for (let i = 1; i < arr.length; i++) {
    for (let j = i - 1; j > -1; j--) {
      if (arr[j + 1] < arr[j]) {
        [arr[j + 1], arr[j]] = [arr[j], arr[j + 1]];
      }
    }
  }

  return arr;
}

module.exports = { sort };

// console.log(insertionSort([23, 1, 10, 5, 2, 300, 12, 20, 80, 23, 57, 55, 78]));
