-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headline" TEXT,
    "location" TEXT,
    "careerPrefs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cv_uploads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "extractedText" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cv_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "company_id" BIGINT NOT NULL,
    "company_name" TEXT,
    "companies_description" TEXT,
    "company_size" DOUBLE PRECISION,
    "state" TEXT,
    "country" TEXT,
    "city" TEXT,
    "zip_code" BIGINT,
    "address" TEXT,
    "url" TEXT,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("company_id")
);

-- CreateTable
CREATE TABLE "job_postings" (
    "job_posting_id" BIGSERIAL NOT NULL,
    "company_id" BIGINT,
    "title" TEXT,
    "job_description" TEXT,
    "location" TEXT,
    "views" DOUBLE PRECISION,
    "formatted_work_type" TEXT,
    "applies" DOUBLE PRECISION,
    "original_listed_time" BIGINT,
    "remote_allowed" DOUBLE PRECISION,
    "job_posting_url" TEXT,
    "application_url" TEXT,
    "application_type" TEXT,
    "expiry" BIGINT,
    "closed_time" BIGINT,
    "formatted_experience_level" TEXT,
    "skills_desc" TEXT,
    "listed_time" BIGINT,
    "posting_domain" TEXT,
    "sponsored" INTEGER,
    "work_type" TEXT,

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("job_posting_id")
);

-- CreateTable
CREATE TABLE "skills" (
    "skill_id" TEXT NOT NULL,
    "skill_name" TEXT,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("skill_id")
);

-- CreateTable
CREATE TABLE "job_skills" (
    "job_skill_id" BIGINT NOT NULL,
    "job_posting_id" BIGINT NOT NULL,
    "skill_id" TEXT NOT NULL,

    CONSTRAINT "job_skills_pkey" PRIMARY KEY ("job_skill_id")
);

-- CreateTable
CREATE TABLE "industries" (
    "industry_id" BIGINT NOT NULL,
    "industry_name" TEXT,

    CONSTRAINT "industries_pkey" PRIMARY KEY ("industry_id")
);

-- CreateTable
CREATE TABLE "company_industries" (
    "company_industries_id" BIGINT NOT NULL,
    "company_id" BIGINT NOT NULL,
    "industry_id" BIGINT NOT NULL,

    CONSTRAINT "company_industries_pkey" PRIMARY KEY ("company_industries_id")
);

-- CreateTable
CREATE TABLE "job_industries" (
    "job_industries_id" BIGINT NOT NULL,
    "job_posting_id" BIGINT NOT NULL,
    "industry_id" BIGINT NOT NULL,

    CONSTRAINT "job_industries_pkey" PRIMARY KEY ("job_industries_id")
);

-- CreateTable
CREATE TABLE "company_specialities" (
    "company_specialities_id" BIGINT NOT NULL,
    "company_id" BIGINT NOT NULL,
    "specialty" TEXT,

    CONSTRAINT "company_specialities_pkey" PRIMARY KEY ("company_specialities_id")
);

-- CreateTable
CREATE TABLE "employee_counts" (
    "employee_counts_id" BIGINT NOT NULL,
    "company_id" BIGINT NOT NULL,
    "employee_count" BIGINT,
    "follower_count" BIGINT,
    "time_recorded" BIGINT,

    CONSTRAINT "employee_counts_pkey" PRIMARY KEY ("employee_counts_id")
);

-- CreateTable
CREATE TABLE "salaries" (
    "salary_id" BIGINT NOT NULL,
    "job_posting_id" BIGINT NOT NULL,
    "max_salary" DOUBLE PRECISION,
    "med_salary" DOUBLE PRECISION,
    "min_salary" DOUBLE PRECISION,
    "pay_period" TEXT,
    "currency" TEXT,
    "compensation_type" TEXT,

    CONSTRAINT "salaries_pkey" PRIMARY KEY ("salary_id")
);

-- CreateTable
CREATE TABLE "benefits" (
    "benefits_id" BIGINT NOT NULL,
    "job_posting_id" BIGINT NOT NULL,
    "inferred" INTEGER,
    "type" TEXT,

    CONSTRAINT "benefits_pkey" PRIMARY KEY ("benefits_id")
);

-- CreateTable
CREATE TABLE "match_results" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cvUploadId" TEXT NOT NULL,
    "jobPostingId" BIGINT NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "skillGapJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_uploads" ADD CONSTRAINT "cv_uploads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_job_posting_id_fkey" FOREIGN KEY ("job_posting_id") REFERENCES "job_postings"("job_posting_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("skill_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_industries" ADD CONSTRAINT "company_industries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_industries" ADD CONSTRAINT "company_industries_industry_id_fkey" FOREIGN KEY ("industry_id") REFERENCES "industries"("industry_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_industries" ADD CONSTRAINT "job_industries_job_posting_id_fkey" FOREIGN KEY ("job_posting_id") REFERENCES "job_postings"("job_posting_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_industries" ADD CONSTRAINT "job_industries_industry_id_fkey" FOREIGN KEY ("industry_id") REFERENCES "industries"("industry_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_specialities" ADD CONSTRAINT "company_specialities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_counts" ADD CONSTRAINT "employee_counts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salaries" ADD CONSTRAINT "salaries_job_posting_id_fkey" FOREIGN KEY ("job_posting_id") REFERENCES "job_postings"("job_posting_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_job_posting_id_fkey" FOREIGN KEY ("job_posting_id") REFERENCES "job_postings"("job_posting_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_cvUploadId_fkey" FOREIGN KEY ("cvUploadId") REFERENCES "cv_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "job_postings"("job_posting_id") ON DELETE CASCADE ON UPDATE CASCADE;
