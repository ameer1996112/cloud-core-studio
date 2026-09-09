/** Bound UI waits without treating a temporary connection failure as a sign-out. */
export function withDeadline<T>(operation: PromiseLike<T>, milliseconds = 8_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Connection timed out. Please retry.")),
      milliseconds,
    );
    Promise.resolve(operation).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
