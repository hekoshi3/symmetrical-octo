//app/not-found.tsx
//html tag is needed because only children is included in the root layout, and the nested layout already has a
//html tag that depends on the language parameter
const NotFound = () => {
    return (
        <html lang="en">
            <body>
                <div className="flex flex-col gap-10">
                    <h1>Oops</h1>
                    <p>The requested page does not exist</p>
                </div>
            </body>
        </html>
    );
}

export default NotFound;