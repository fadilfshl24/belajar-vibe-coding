async function check() {
  const url = "https://ibnux.github.io/data-indonesia/kabupaten/11.json";
  const res = await fetch(url);
  console.log(res.status);
  if (res.ok) {
    const data = await res.json();
    console.log(data.slice(0, 2));
  }
}
check();
