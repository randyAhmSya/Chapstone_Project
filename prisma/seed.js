// Utilitiimport "dotenv/config";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path, { dirname } from "path";
import { parse } from "csv-parse/sync";
import { fileURLToPath } from "url";

// Merakit ulang __dirname untuk ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();
const DATA = path.join(__dirname, "data");

function readCsv(filename) {
    const fp = path.join(DATA, filename);
    if (!fs.existsSync(fp)) {
        console.warn(`  ${filename} tidak ada di prisma/data/ — dilewati`);
        return [];
    }
    return parse(fs.readFileSync(fp, "utf-8"), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: true,
        relax_quotes: true,
        quote: null,
    });
}

const toInt = (v) =>
    !v || v === "" ? null : isNaN(parseInt(v)) ? null : parseInt(v);
const toFloat = (v) =>
    !v || v === "" ? null : isNaN(parseFloat(v)) ? null : parseFloat(v);

// Utility khusus untuk menangani angka besar (termasuk jika diekspor Pandas sebagai string "1234.0")
const toBigInt = (v) => {
    if (!v || v === "") return null;
    const cleanV = String(v).split(".")[0];
    try {
        return BigInt(cleanV);
    } catch (e) {
        return null;
    }
};

async function step(label, fn) {
    process.stdout.write(`  ${label}... `);
    const count = await fn();
    console.log(`✅ ${count} baris`);
    return count;
}

//  Main

async function main() {
    console.log("\n SkillAlign — Database Seed (BigInt Optimized)\n");
    console.log(`Data folder : ${DATA}`);
    console.log(`Database   : Supabase PostgreSQL via Prisma\n`);
    console.log("─".repeat(50));

    // 1. SKILLS
    await step("Skills (skills.csv)", async () => {
        const rows = readCsv("skills.csv");
        let n = 0;
        for (const r of rows) {
            if (!r.skill_id) continue;
            await prisma.skill.upsert({
                where: { skillId: r.skill_id },
                update: { skillName: r.skill_name },
                create: { skillId: r.skill_id, skillName: r.skill_name },
            });
            n++;
        }
        return n;
    });

    // 2. INDUSTRIES
    await step("Industries (industries.csv)", async () => {
        const rows = readCsv("industries.csv");
        let n = 0;
        for (const r of rows) {
            const id = toBigInt(r.industry_id);
            if (id === null) continue;
            await prisma.industry.upsert({
                where: { industryId: id },
                update: { industryName: r.industry_name || null },
                create: { industryId: id, industryName: r.industry_name || null },
            });
            n++;
        }
        return n;
    });

    // 3. COMPANIES
    await step("Companies (companies.csv)", async () => {
        const rows = readCsv("companies_sample.csv"); // Sesuaikan nama file sample/asli
        let n = 0;
        for (const r of rows) {
            const id = toBigInt(r.company_id);
            if (!id) continue;
            await prisma.company.upsert({
                where: { id: id },
                update: {},
                create: {
                    id: id,
                    companyName: r.company_name || `Company ${id}`,
                    companyDescription: r.companies_description || r.description || null,
                    companySize: toFloat(r.company_size),
                    city: r.city || null,
                    state: r.state || null,
                    country: r.country || null,
                    zipCode: toBigInt(r.zip_code) || null,
                    address: r.address || null,
                    url: r.url || null,
                },
            });
            n++;
        }
        return n;
    });

    // Ambil Set ID valid untuk validasi FK selanjutnya (sekarang membandingkan BigInt)
    const dbCompanies = await prisma.company.findMany({ select: { id: true } });
    const dbIndustries = await prisma.industry.findMany({
        select: { industryId: true },
    });
    const validCo = new Set(dbCompanies.map((c) => c.id.toString())); // Simpan sebagai string untuk .has() comparison
    const validInd = new Set(dbIndustries.map((i) => i.industryId.toString()));

    // 4. EMPLOYEE COUNTS
    await step("Employee counts (employee_counts.csv)", async () => {
        const rows = readCsv("employee_counts.csv");
        let n = 0;
        for (const r of rows) {
            const cid = toBigInt(r.company_id);
            if (!cid || !validCo.has(cid.toString())) continue;

            const eid = toBigInt(r.employee_counts_id);
            if (!eid) continue;

            await prisma.employeeCount.upsert({
                where: { id: eid },
                update: {},
                create: {
                    id: eid,
                    companyId: cid,
                    employeeCount: toBigInt(r.employee_count),
                    followerCount: toBigInt(r.follower_count),
                    timeRecorded: toBigInt(r.time_recorded),
                },
            });
            n++;
        }
        return n;
    });

    //  5. COMPANY INDUSTRIES
    await step("Company industries (company_industries.csv)", async () => {
        const rows = readCsv("company_industries.csv");
        let n = 0;
        for (const r of rows) {
            const cid = toBigInt(r.company_id);
            const iid = toBigInt(r.industry_id);
            const pk = toBigInt(r.company_industries_id);

            if (
                !pk ||
                !cid ||
                !iid ||
                !validCo.has(cid.toString()) ||
                !validInd.has(iid.toString())
            )
                continue;

            await prisma.companyIndustry.upsert({
                where: { id: pk },
                update: {},
                create: { id: pk, companyId: cid, industryId: iid },
            });
            n++;
        }
        return n;
    });

    //  6. COMPANY SPECIALITIES
    await step("Company specialities (company_specialities.csv)", async () => {
        const rows = readCsv("company_specialities.csv");
        let n = 0;
        for (const r of rows) {
            const cid = toBigInt(r.company_id);
            const pk = toBigInt(r.company_specialities_id);

            if (!pk || !cid || !validCo.has(cid.toString()) || !r.speciality)
                continue;

            await prisma.companySpecialty.upsert({
                where: { id: pk },
                update: {},
                create: { id: pk, companyId: cid, specialty: r.speciality },
            });
            n++;
        }
        return n;
    });

    //  7. JOB POSTINGS
    await step("Job postings (job_postings.csv)", async () => {
        const rows = readCsv("job_postings_sample.csv"); // Sesuaikan nama file sample/asli
        let n = 0;
        for (const r of rows) {
            const jid = toBigInt(r.job_posting_id || r.job_id); // Support header asli/sample
            if (!jid) continue;

            const cid = toBigInt(r.company_id);
            const isValidCompany = cid && validCo.has(cid.toString());

            await prisma.jobPosting.upsert({
                where: { id: jid },
                update: {},
                create: {
                    id: jid,
                    companyId: isValidCompany ? cid : null,
                    title: r.title || "Unknown",
                    description: r.job_description || r.description || "",
                    location: r.location || null,
                    views: toFloat(r.views),
                    formattedWorkType: r.formatted_work_type || null,
                    applies: toFloat(r.applies),
                    originalListedTime: toBigInt(r.original_listed_time),
                    remoteAllowed: toFloat(r.remote_allowed), // 10 atau 0
                    jobPostingUrl: r.job_posting_url || null,
                    applicationUrl: r.application_url ? String(r.application_url) : null,
                    applicationType: r.application_type || null,
                    expiry: toBigInt(r.expiry),
                    closedTime: toBigInt(r.closed_time),
                    formattedExperienceLevel: r.formatted_experience_level || null,
                    skillsDesc: r.skills_desc || null,
                    listedTime: toBigInt(r.listed_time),
                    postingDomain: r.posting_domain ? String(r.posting_domain) : null,
                    sponsored: toInt(r.sponsored),
                    workType: r.work_type || null,
                },
            });
            n++;
        }
        return n;
    });

    // Ambil job IDs valid
    const dbJobs = await prisma.jobPosting.findMany({ select: { id: true } });
    const validJo = new Set(dbJobs.map((j) => j.id.toString()));

    // Ambil skill IDs valid
    const dbSkills = await prisma.skill.findMany({ select: { skillId: true } });
    const validSk = new Set(dbSkills.map((s) => s.skillId));

    // 8. JOB SKILLS
    await step("Job skills (job_skills.csv)", async () => {
        const rows = readCsv("job_skills.csv");
        let n = 0;
        for (const r of rows) {
            const pk = toBigInt(r.job_skill_id);
            const jid = toBigInt(r.job_posting_id);
            const sid = r.skill_id;

            if (!pk || !jid || !validJo.has(jid.toString()) || !validSk.has(sid))
                continue;

            await prisma.jobSkill.upsert({
                where: { id: pk },
                update: {},
                create: { id: pk, jobPostingId: jid, skillId: sid },
            });
            n++;
        }
        return n;
    });

    // 9. JOB INDUSTRIES
    await step("Job industries (job_industries.csv)", async () => {
        const rows = readCsv("job_industries.csv");
        let n = 0;
        for (const r of rows) {
            const pk = toBigInt(r.job_industries_id);
            const jid = toBigInt(r.job_posting_id);
            const iid = toBigInt(r.industry_id);

            if (
                !pk ||
                !jid ||
                !iid ||
                !validJo.has(jid.toString()) ||
                !validInd.has(iid.toString())
            )
                continue;

            await prisma.jobIndustry.upsert({
                where: { id: pk },
                update: {},
                create: { id: pk, jobPostingId: jid, industryId: iid },
            });
            n++;
        }
        return n;
    });

    // 10. SALARIES
    await step("Salaries (salaries.csv)", async () => {
        const rows = readCsv("salaries.csv");
        let n = 0;
        for (const r of rows) {
            const pk = toBigInt(r.salary_id);
            const jid = toBigInt(r.job_posting_id);

            if (!pk || !jid || !validJo.has(jid.toString())) continue;

            await prisma.salary.upsert({
                where: { id: pk },
                update: {},
                create: {
                    id: pk,
                    jobPostingId: jid,
                    maxSalary: toFloat(r.max_salary),
                    medSalary: toFloat(r.med_salary),
                    minSalary: toFloat(r.min_salary),
                    payPeriod: r.pay_period || null,
                    currency: r.currency || null,
                    compensationType: r.compensation_type || null,
                },
            });
            n++;
        }
        return n;
    });

    // 11. BENEFITS
    await step("Benefits (benefits.csv)", async () => {
        const rows = readCsv("benefits.csv");
        let n = 0;
        for (const r of rows) {
            const pk = toBigInt(r.benefits_id);
            const jid = toBigInt(r.job_posting_id);

            if (!pk || !jid || !validJo.has(jid.toString()) || !r.type) continue;

            await prisma.benefit.upsert({
                where: { id: pk },
                update: {},
                create: {
                    id: pk,
                    jobPostingId: jid,
                    inferred: toInt(r.inferred),
                    type: r.type,
                },
            });
            n++;
        }
        return n;
    });

    console.log("\n" + "─".repeat(50));
    console.log("Seeding selesai!\n");
    console.log("Langkah selanjutnya:");
    console.log("  npx prisma studio    → lihat data di browser");
    console.log("  npm run dev          → jalankan server\n");
}

main()
    .catch((e) => {
        console.error("\n Seed gagal:", e.message);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
