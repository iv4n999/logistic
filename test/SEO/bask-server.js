app.get('/services', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/services.html'));
});

app.get('/services.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/services.html'));
});

app.get('/prices', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/prices.html'));
});

app.get('/prices.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/prices.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/about.html'));
});

app.get('/about.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/about.html'));
});

app.get('/contacts', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/contacts.html'));
});

app.get('/contacts.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/contacts.html'));
});