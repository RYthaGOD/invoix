# Smart Contract Security Audit Task List

- [ ] Audit `marketplace-program`
    - [ ] Review `lib.rs` for vulnerabilities
        - [ ] Access Control
        - [ ] Integer Overflow/Underflow
        - [ ] PDA validation
        - [ ] Cross-Program Invocation (CPI) checks
    - [ ] Review tests in `marketplace-program/tests`
- [ ] Audit `arcium-mxe`
    - [ ] Review `lib.rs` for vulnerabilities
        - [ ] Access Control
        - [ ] Logic errors
    - [ ] Review tests in `arcium-mxe/tests`
- [ ] Dependency Check
    - [ ] Check `Cargo.toml` for outdated or insecure dependencies
- [ ] Report Findings
