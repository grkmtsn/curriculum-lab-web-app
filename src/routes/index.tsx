import * as fs from 'node:fs'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { createInstitutionHandler, createInstitutionSchema } from '../api/institutions';

export const Route = createFileRoute('/')({
    component: Home,
});

const createInstitution = createServerFn({ method: 'POST' })
    .inputValidator(createInstitutionSchema)
    .handler(async ({ data }) => {
        return createInstitutionHandler(data);
});


function Home() {
    const router = useRouter()
    const state = Route.useLoaderData()

    return (
        <button
            type="button"
            onClick={() => {
               createInstitution({ data: { name: "Educarium", city: "Ilfov" }})
            }}
        >
            Create Institution
        </button>
    )
}